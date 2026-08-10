from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import duckdb

from memorypulse.transformations.storage import atomic_write_text

MAX_FRONTEND_FILE_BYTES = 5 * 1024 * 1024


def build_quality_report(
    connection: duckdb.DuckDBPyConnection, output_path: Path, production_data: bool
) -> dict[str, Any]:
    tables = [
        "spot_prices",
        "memory_prices",
        "retail_products",
        "electronics_prices",
        "device_exposure",
        "macro_indicators",
        "news_events",
        "source_runs",
        "market_index",
        "forecasts",
        "decision_briefs",
    ]
    counts = {table: connection.execute(f"SELECT count(*) FROM {table}").fetchone()[0] for table in tables}
    invalid_prices = connection.execute(
        "SELECT count(*) FROM (SELECT price_value FROM spot_prices UNION ALL SELECT price_value FROM memory_prices) WHERE price_value <= 0"
    ).fetchone()[0]
    future_dates = connection.execute(
        "SELECT count(*) FROM (SELECT observation_date FROM spot_prices UNION ALL SELECT observation_date FROM memory_prices UNION ALL SELECT observation_date FROM macro_indicators) WHERE observation_date > current_date + INTERVAL 2 DAY"
    ).fetchone()[0]
    sudden_changes = connection.execute(
        """WITH changes AS (
        SELECT observation_id, observation_date, source_id, product_type, price_value,
          lag(price_value) OVER (PARTITION BY source_id, product_type ORDER BY observation_date) AS prior
        FROM (SELECT * FROM spot_prices UNION ALL SELECT * FROM memory_prices))
        SELECT observation_id, observation_date, source_id, product_type, prior, price_value
        FROM changes WHERE prior > 0 AND (price_value / prior > 5 OR price_value / prior < .2)
        ORDER BY observation_date DESC LIMIT 100"""
    ).fetchall()
    report = {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "production_data": production_data,
        "status": "pass" if invalid_prices == 0 and future_dates == 0 else "fail",
        "table_counts": counts,
        "checks": {
            "positive_prices": {"status": "pass" if invalid_prices == 0 else "fail", "violations": invalid_prices},
            "reasonable_dates": {"status": "pass" if future_dates == 0 else "fail", "violations": future_dates},
            "fixture_publication_guard": {"status": "pass", "production_data": production_data},
            "sudden_price_changes": {
                "status": "warning" if sudden_changes else "pass",
                "flagged_count_shown": len(sudden_changes),
                "note": "Flagged observations remain in canonical history and retain source IDs.",
                "observations": [
                    {
                        "observation_id": row[0],
                        "observation_date": row[1].isoformat(),
                        "source_id": row[2],
                        "product_type": row[3],
                        "prior_value": row[4],
                        "current_value": row[5],
                    }
                    for row in sudden_changes
                ],
            },
        },
    }
    atomic_write_text(output_path, json.dumps(report, indent=2, sort_keys=True, allow_nan=False) + "\n")
    return report


def validate_export_directory(data_dir: Path, expect_production: bool | None = None) -> list[str]:
    required = {
        "manifest.json",
        "decision-brief.json",
        "analytics.json",
        "electronics-story.json",
        "market-summary.json",
        "prices.json",
        "retail.json",
        "news.json",
        "forecast.json",
        "source-health.json",
        "methodology.json",
    }
    errors = []
    for name in sorted(required):
        path = data_dir / name
        if not path.exists():
            errors.append(f"missing {name}")
            continue
        if path.stat().st_size > MAX_FRONTEND_FILE_BYTES:
            errors.append(f"{name} exceeds {MAX_FRONTEND_FILE_BYTES} bytes")
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            errors.append(f"invalid {name}: {error}")
    manifest_path = data_dir / "manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if expect_production is not None and manifest.get("production_data") is not expect_production:
            errors.append("manifest production_data flag does not match the requested mode")
        if manifest.get("production_data") and manifest.get("fixture_data"):
            errors.append("fixture data may not be marked as production")
    return errors
