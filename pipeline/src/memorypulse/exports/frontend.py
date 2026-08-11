from __future__ import annotations

import json
import math
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import duckdb

from memorypulse.analysis.briefing import (
    build_business_analytics,
    build_decision_brief,
    build_electronics_story,
)
from memorypulse.analysis.evidence import build_evidence_readiness
from memorypulse.indicators.pressure import IndexResult, calculate_index, components_from_database
from memorypulse.transformations.storage import atomic_write_text

SCHEMA_VERSION = "1.6.0"


def _json_value(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat().replace("+00:00", "Z")
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, dict):
        return {str(key): _json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_value(item) for item in value]
    return value


def _write(path: Path, value: Any) -> None:
    content = json.dumps(_json_value(value), ensure_ascii=False, separators=(",", ":"), sort_keys=True, allow_nan=False)
    atomic_write_text(path, content + "\n")


def _rows(connection: duckdb.DuckDBPyConnection, query: str) -> list[dict[str, Any]]:
    result = connection.execute(query)
    columns = [description[0] for description in result.description]
    return [dict(zip(columns, row, strict=True)) for row in result.fetchall()]


def _latest_observation(connection: duckdb.DuckDBPyConnection) -> date | None:
    return connection.execute(
        """SELECT max(observation_date) FROM (
        SELECT observation_date FROM spot_prices UNION ALL
        SELECT observation_date FROM memory_prices UNION ALL
        SELECT observation_date FROM retail_products UNION ALL
        SELECT observation_date FROM macro_indicators)"""
    ).fetchone()[0]


def _key_changes(connection: duckdb.DuckDBPyConnection) -> dict[str, float | None]:
    rows = _rows(
        connection,
        """SELECT observation_date, source_id, product_type, memory_generation, price_per_gb, price_basis
        FROM memory_prices WHERE memory_generation IN ('DDR4', 'DDR5') AND price_per_gb IS NOT NULL
        ORDER BY observation_date, source_id, product_type""",
    )
    chosen: dict[str, tuple[dict[str, Any], dict[str, Any]]] = {}
    for generation in ("DDR4", "DDR5"):
        candidates: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for row in rows:
            if row["memory_generation"] == generation:
                candidates[f"{row['source_id']}::{row['product_type']}"].append(row)
        eligible = [points for points in candidates.values() if len(points) >= 2]
        if eligible:
            preferred = [points for points in eligible if str(points[-1]["product_type"]).startswith(f"{generation} (")]
            points = max(preferred or eligible, key=lambda item: item[-1]["observation_date"])
            chosen[generation] = (points[-2], points[-1])
    output: dict[str, float | None] = {
        "ddr4_recent_change": None,
        "ddr5_recent_change": None,
        "ddr5_minus_ddr4_spread": None,
    }
    for generation, key in (("DDR4", "ddr4_recent_change"), ("DDR5", "ddr5_recent_change")):
        if generation in chosen:
            previous, latest = chosen[generation]
            output[key] = 100 * (float(latest["price_per_gb"]) / float(previous["price_per_gb"]) - 1)
    if "DDR4" in chosen and "DDR5" in chosen:
        ddr4 = chosen["DDR4"][1]
        ddr5 = chosen["DDR5"][1]
        compatible = ddr4["source_id"] == ddr5["source_id"] and ddr4["price_basis"] == ddr5["price_basis"]
        if compatible:
            output["ddr5_minus_ddr4_spread"] = float(ddr5["price_per_gb"]) - float(ddr4["price_per_gb"])
    return output


def _price_export(connection: duckdb.DuckDBPyConnection) -> dict[str, Any]:
    rows = _rows(
        connection,
        """SELECT observation_date AS date, source_id, market_type, memory_generation,
        product_type, price_value AS value, price_per_gb, currency, price_basis, is_estimate,
        source_url, source_label FROM memory_prices
        UNION ALL SELECT observation_date, source_id, market_type, memory_generation,
        product_type, price_value, price_per_gb, currency, price_basis, is_estimate,
        source_url, source_label FROM spot_prices
        ORDER BY date, source_id, product_type""",
    )
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    metadata: dict[str, dict[str, Any]] = {}
    for row in rows:
        key = f"{row['source_id']}::{row['product_type']}"
        grouped[key].append(
            {
                "date": row["date"],
                "value": row["value"],
                "price_per_gb": row["price_per_gb"],
                "estimate": row["is_estimate"],
            }
        )
        metadata[key] = {
            "id": key,
            "label": row["product_type"],
            "generation": row["memory_generation"],
            "market_type": row["market_type"],
            "currency": row["currency"],
            "basis": row["price_basis"],
            "source_id": row["source_id"],
            "source_label": row["source_label"],
            "source_url": row["source_url"],
            "is_estimate": row["is_estimate"],
        }
    return {
        "series": [{**metadata[key], "points": grouped[key]} for key in sorted(grouped)],
        "units_note": "Series retain source definitions. Values are not combined across incompatible bases.",
    }


def _retail_export(connection: duckdb.DuckDBPyConnection) -> dict[str, Any]:
    products = _rows(connection, "SELECT * FROM retail_products ORDER BY observation_date DESC, retailer, sku LIMIT 1000")
    summaries = _rows(connection, "SELECT * FROM retail_generation_summary ORDER BY observation_date, generation")
    return {"products": products, "generation_summaries": summaries}


def _news_export(connection: duckdb.DuckDBPyConnection) -> dict[str, Any]:
    events = _rows(
        connection,
        """SELECT event_id, published_at, title, source_domain, source_name, article_url,
        query_category, companies, memory_types, event_tags, short_excerpt, relevance_score
        FROM news_events ORDER BY published_at DESC LIMIT 2000""",
    )
    filters = {
        "companies": sorted({item for row in events for item in (row["companies"] or []) if item}),
        "memory_types": sorted({item for row in events for item in (row["memory_types"] or []) if item}),
        "event_tags": sorted({item for row in events for item in (row["event_tags"] or []) if item}),
    }
    counts = _rows(connection, "SELECT published_at::DATE AS date, count(*) AS count FROM news_events GROUP BY 1 ORDER BY 1")
    return {"events": events, "daily_counts": counts, "filters": filters, "retention_days": 365}


def _forecast_export(connection: duckdb.DuckDBPyConnection) -> dict[str, Any]:
    forecasts = _rows(connection, "SELECT * FROM forecasts ORDER BY forecast_created_at DESC, series_id, target_date")
    accuracy = _rows(connection, "SELECT * FROM forecast_accuracy WHERE actual_value IS NOT NULL ORDER BY target_date")
    outlooks = _rows(
        connection,
        """SELECT * FROM industry_outlooks
        ORDER BY published_at DESC, segment, metric""",
    )
    structural = _rows(
        connection,
        """SELECT * FROM structural_forecasts
        ORDER BY forecast_created_at DESC, target_date, scenario""",
    )
    return {
        "forecasts": forecasts,
        "structural_forecasts": structural,
        "evidence_readiness": build_evidence_readiness(connection),
        "historical_accuracy": accuracy,
        "industry_outlooks": outlooks,
        "empty_message": "Collecting additional history before publishing a forecast.",
        "disclaimer": "Short-term forecasts are statistical estimates. The 12 to 24 month paths are market-informed scenarios. Industry outlooks remain attributed external views. None guarantees future prices.",
    }


def _health_export(connection: duckdb.DuckDBPyConnection) -> dict[str, Any]:
    latest = _rows(
        connection,
        """WITH ranked AS (
          SELECT *, row_number() OVER (
            PARTITION BY source_id ORDER BY completed_at DESC, started_at DESC, run_id DESC
          ) AS recency_rank
          FROM source_runs
        ), totals AS (
          SELECT source_id,
            max(completed_at) FILTER (status = 'success') AS latest_retrieval,
            max(data_freshness_at) AS latest_observation,
            sum(records_written) AS records_collected,
            sum(records_rejected) AS records_rejected
          FROM source_runs GROUP BY source_id
        )
        SELECT ranked.source_id, ranked.status, totals.latest_retrieval,
          ranked.completed_at AS latest_attempt, totals.latest_observation,
          totals.records_collected, totals.records_rejected,
          CASE WHEN ranked.status = 'success' THEN '' ELSE coalesce(ranked.failure_reason, '') END AS reason,
          coalesce(ranked.optional_key_configured, false) AS optional_key_configured
        FROM ranked JOIN totals USING (source_id)
        WHERE ranked.recency_rank = 1 ORDER BY ranked.source_id""",
    )
    source_kinds = {
        "bestbuy_memory_products": "permission_required",
        "keepa_ddr5_panel": "permission_required",
        "census_memory_imports": "optional",
        "census_memory_exports": "optional",
        "dramexchange_homepage": "permission_required",
        "sec_memory_supplier_fundamentals": "optional",
    }
    for source in latest:
        source["source_kind"] = source_kinds.get(str(source["source_id"]), "core")
    return {"sources": latest}


def export_frontend(
    connection: duckdb.DuckDBPyConnection,
    output_dir: Path,
    weights: dict[str, float],
    methodology_version: str,
    pipeline_run_id: str,
    production_data: bool,
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    generated = datetime.now(timezone.utc).replace(microsecond=0)
    latest_observation = _latest_observation(connection)
    components = components_from_database(connection)
    index_result: IndexResult = calculate_index(
        components, weights, methodology_version, latest_observation or generated.date()
    )
    index = index_result.observation
    latest_run = connection.execute("SELECT max(completed_at) FROM source_runs").fetchone()[0]
    latest_success = connection.execute(
        "SELECT max(completed_at) FROM source_runs WHERE status = 'success'"
    ).fetchone()[0]
    key_changes = _key_changes(connection)
    summary = {
        "latest_index": index.to_record() if index.confidence_score > 0 else None,
        "components": [component.as_dict() for component in index_result.components],
        "confidence": index.confidence_score,
        "latest_observation": latest_observation,
        "last_pipeline_run": latest_run,
        "last_successful_update": latest_success,
        "website_build": generated,
        "key_changes": key_changes,
        "insights": index_result.insights,
        "disclaimer": "The Memory Pressure Index is an analytical indicator, not an official industry index or a certain shortage predictor.",
    }
    decision_brief = build_decision_brief(connection, index_result, weights, key_changes, generated)
    prior_briefs = _rows(
        connection,
        """SELECT brief_id, generated_at, regime, direction, confidence, confidence_score,
        pressure_score, procurement_posture, inventory_posture, budget_risk, conclusion
        FROM decision_briefs ORDER BY generated_at DESC LIMIT 29""",
    )
    decision_brief["history"] = [
        {
            "brief_id": decision_brief["brief_id"],
            "generated_at": decision_brief["generated_at"],
            "regime": decision_brief["regime"],
            "direction": decision_brief["direction"],
            "confidence": decision_brief["confidence"],
            "confidence_score": decision_brief["confidence_score"],
            "pressure_score": decision_brief["pressure_score"],
            "procurement_posture": decision_brief["recommended_posture"]["procurement"],
            "inventory_posture": decision_brief["recommended_posture"]["inventory"],
            "budget_risk": decision_brief["recommended_posture"]["budget_risk"],
            "conclusion": decision_brief["conclusion"],
        },
        *[item for item in prior_briefs if item["brief_id"] != decision_brief["brief_id"]],
    ]
    files = {
        "decision-brief.json": decision_brief,
        "electronics-story.json": build_electronics_story(connection, decision_brief),
        "analytics.json": build_business_analytics(connection, index_result, weights),
        "market-summary.json": summary,
        "prices.json": _price_export(connection),
        "retail.json": _retail_export(connection),
        "news.json": _news_export(connection),
        "forecast.json": _forecast_export(connection),
        "source-health.json": _health_export(connection),
        "methodology.json": {
            "version": methodology_version,
            "weights": weights,
            "normalization": "Robust 10th to 90th percentile scaling; values are clamped to 0 to 100.",
            "missing_data": "Available components are reweighted; confidence is represented configured weight.",
            "unit_rule": "Gb means gigabits and GB means gigabytes. Conversion is never inferred from ambiguous text.",
            "forecasting": "Horizon-specific rolling-origin validation compares ten short-term candidates. A separately governed 12 to 24 month driver ensemble dynamically reweights DDR5 momentum, official semiconductor producer and import prices, capacity utilization, and attributed research. Long-range statistical modeling remains gated by explicit history, source, product-panel, and driver thresholds.",
            "caveats": [
                "Chip spot prices and retail module prices use different definitions.",
                "Official device starting prices are not always like-for-like when memory, storage, and performance configurations change.",
                "Device exposure outputs are transparent scenarios, not retail-price forecasts.",
                "HBM estimates are labeled and are not presented as observed public transaction prices.",
                "Associations and conceptual mechanisms do not establish causality.",
            ],
        },
    }
    for name, value in files.items():
        _write(output_dir / name, value)
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": generated,
        "pipeline_run_id": pipeline_run_id,
        "methodology_version": methodology_version,
        "files": sorted([*files, "manifest.json"]),
        "latest_observation": latest_observation,
        "production_data": production_data,
        "fixture_data": not production_data,
    }
    _write(output_dir / "manifest.json", manifest)
    return manifest
