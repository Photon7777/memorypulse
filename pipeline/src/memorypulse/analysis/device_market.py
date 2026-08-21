from __future__ import annotations

from collections import Counter
from statistics import median
from typing import Any

import duckdb

from memorypulse.config import device_watchlist


def _rows(connection: duckdb.DuckDBPyConnection, query: str) -> list[dict[str, Any]]:
    result = connection.execute(query)
    columns = [description[0] for description in result.description]
    return [dict(zip(columns, row, strict=True)) for row in result.fetchall()]


def _clamp(value: float, minimum: float = 0, maximum: float = 100) -> float:
    return max(minimum, min(maximum, value))


def _median(values: list[float]) -> float | None:
    return round(float(median(values)), 1) if values else None


def _watchlist_summary() -> dict[str, Any]:
    config = device_watchlist()
    categories = config.get("categories", {})
    families = [
        {"category": category, "manufacturer": manufacturer, "family": family}
        for category, category_config in categories.items()
        for manufacturer, names in category_config.get("families", {}).items()
        for family in names
    ]
    return {
        "version": config.get("version"),
        "market": config.get("market", "US"),
        "free_only": bool(config.get("free_only", True)),
        "cadence": config.get("cadence", {}),
        "panel_targets": config.get("panel_targets", {}),
        "categories": [
            {
                "id": category,
                "families": sum(len(names) for names in value.get("families", {}).values()),
                "manufacturers": len(value.get("families", {})),
                "target_configurations": int(value.get("target_configurations", 0)),
            }
            for category, value in categories.items()
        ],
        "family_count": len(families),
        "manufacturer_count": len({item["manufacturer"] for item in families}),
        "target_configurations": sum(
            int(value.get("target_configurations", 0)) for value in categories.values()
        ),
        "families": families,
        "upstream_companies": config.get("upstream_companies", {}),
        "source_policy": config.get("source_policy", {}),
    }


def build_device_market(connection: duckdb.DuckDBPyConnection) -> dict[str, Any]:
    watchlist = _watchlist_summary()
    snapshots = _rows(
        connection,
        """SELECT * FROM device_configuration_snapshots
        WHERE review_status != 'rejected'
        ORDER BY observation_date DESC, category, manufacturer, product_family""",
    )
    events = _rows(
        connection,
        """SELECT * FROM device_change_events
        WHERE previous_snapshot_id IS NOT NULL
        ORDER BY observation_date DESC, category, manufacturer, product_family""",
    )
    comparable = [
        row for row in events
        if row["response_type"] not in {"insufficient_evidence", "new_entry_tier"}
    ]
    approved = [row for row in snapshots if row["review_status"] == "approved"]
    official = [row for row in approved if row["source_tier"] == "official"]
    price_changes = [float(row["price_change_percent"]) for row in comparable if row["price_change_percent"] is not None]
    value_changes = [
        float(row["memory_value_change_percent"])
        for row in comparable if row["memory_value_change_percent"] is not None
    ]
    compression = [
        row for row in comparable
        if row["response_type"] in {"specification_compression", "price_and_spec_compression"}
    ]
    price_pressure = _median(price_changes)
    upgrade_tax = _median(value_changes)
    compression_rate = round(100 * len(compression) / len(comparable), 1) if comparable else None
    if comparable:
        burden = round(
            0.45 * _clamp(50 + 2 * (price_pressure or 0))
            + 0.35 * (compression_rate or 0)
            + 0.20 * _clamp(50 + (upgrade_tax or 0)),
            1,
        )
    else:
        burden = None
    thresholds = watchlist["panel_targets"]
    transition_target = int(thresholds.get("minimum_comparable_transitions_for_modeling", 100))
    family_target = int(thresholds.get("minimum_families", 40))
    primary_target = float(thresholds.get("minimum_primary_source_share", 0.8))
    reviewed_families = len({row["product_family"] for row in approved})
    source_share = len(official) / len(approved) if approved else 0
    categories = len({row["category"] for row in approved})
    model_ready = (
        len(comparable) >= transition_target
        and reviewed_families >= family_target
        and source_share >= primary_target
        and categories >= 3
    )
    response_counts = Counter(str(row["response_type"]) for row in events)
    review_queue = _rows(
        connection,
        """SELECT event_id, published_at, title, source_domain, source_name, article_url,
        query_category, companies, memory_types, event_tags, relevance_score
        FROM news_events
        WHERE query_category IN ('device_configuration', 'official_product', 'market_policy')
        ORDER BY published_at DESC LIMIT 100""",
    )
    return {
        "generated_from": "reviewed configuration snapshots; news discovery never changes metrics automatically",
        "watchlist": watchlist,
        "metrics": {
            "sticker_price_pressure_percent": price_pressure,
            "spec_compression_rate_percent": compression_rate,
            "consumer_memory_burden": burden,
            "memory_value_change_percent": upgrade_tax,
            "comparable_transitions": len(comparable),
            "approved_snapshots": len(approved),
            "primary_source_share": round(source_share, 3),
            "confidence": round(min(1.0, len(comparable) / transition_target) * source_share, 3),
        },
        "metric_definitions": {
            "sticker_price_pressure_percent": "Median list-price change across reviewed, comparable device transitions.",
            "spec_compression_rate_percent": "Share of comparable transitions with less RAM or storage at a similar or higher price.",
            "memory_value_change_percent": "Median change in price per GB of included system RAM where both generations disclose RAM.",
            "consumer_memory_burden": "A 0–100 descriptive blend of price change, specification compression, and RAM value change. It is not a causal estimate.",
        },
        "coverage": {
            "reviewed_families": reviewed_families,
            "watchlist_families": watchlist["family_count"],
            "reviewed_categories": categories,
            "watchlist_categories": len(watchlist["categories"]),
            "reviewed_manufacturers": len({row["manufacturer"] for row in approved}),
            "watchlist_manufacturers": watchlist["manufacturer_count"],
        },
        "model_readiness": {
            "ready": model_ready,
            "status": "ready" if model_ready else "panel_building",
            "thresholds": {
                "comparable_transitions": transition_target,
                "reviewed_families": family_target,
                "primary_source_share": primary_target,
                "categories": 3,
            },
            "current": {
                "comparable_transitions": len(comparable),
                "reviewed_families": reviewed_families,
                "primary_source_share": round(source_share, 3),
                "categories": categories,
            },
            "explanation": (
                "The device layer is descriptive until its preregistered coverage gates are met. "
                "It remains separate from the DDR5 price forecast."
            ),
        },
        "response_counts": [
            {"response_type": key, "count": value}
            for key, value in sorted(response_counts.items())
        ],
        "events": events,
        "snapshots": snapshots,
        "review_queue": review_queue,
        "conclusion": (
            "Reviewed examples show that manufacturers can respond to component pressure through "
            "both sticker-price changes and configuration changes. The panel is not yet broad enough "
            "to claim that this is the market-wide norm."
        ),
        "disclaimer": (
            "Configuration comparisons are reviewed individually. Promotions, bundles, regional taxes, "
            "performance changes, and launch timing can limit comparability."
        ),
    }
