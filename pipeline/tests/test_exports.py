from __future__ import annotations

import json
from datetime import datetime, timezone

from memorypulse.database import create_database
from memorypulse.exports.frontend import export_frontend
from memorypulse.quality.report import validate_export_directory
from memorypulse.transformations.storage import ensure_history_files


def test_export_contracts_are_valid(tmp_path) -> None:
    history = tmp_path / "history"
    ensure_history_files(history)
    connection = create_database(history, tmp_path / "test.duckdb")
    data_dir = tmp_path / "data"
    export_frontend(
        connection,
        data_dir,
        {
            "spot_momentum": 0.30,
            "retail_momentum": 0.25,
            "volatility": 0.15,
            "news_pressure": 0.15,
            "macro_pressure": 0.15,
        },
        "test",
        "test_pipeline",
        production_data=True,
    )
    connection.close()
    assert validate_export_directory(data_dir, expect_production=True) == []
    manifest = json.loads((data_dir / "manifest.json").read_text())
    assert manifest["production_data"] is True
    assert manifest["fixture_data"] is False
    assert manifest["schema_version"] == "1.5.0"
    brief = json.loads((data_dir / "decision-brief.json").read_text())
    assert brief["regime"] == "Watch"
    assert brief["conclusion"]
    assert len(brief["history"]) == 1
    analytics = json.loads((data_dir / "analytics.json").read_text())
    assert analytics["model_readiness"]["advanced_ml_ready"] is False
    story = json.loads((data_dir / "electronics-story.json").read_text())
    assert story["story"]["proves"]
    forecast = json.loads((data_dir / "forecast.json").read_text())
    assert "industry_outlooks" in forecast
    assert "structural_forecasts" in forecast


def test_fixture_publication_guard_is_detected(tmp_path) -> None:
    data = tmp_path / "data"
    data.mkdir()
    for name in (
        "decision-brief.json", "analytics.json", "electronics-story.json", "market-summary.json", "prices.json", "retail.json", "news.json", "forecast.json",
        "source-health.json", "methodology.json",
    ):
        (data / name).write_text("{}")
    (data / "manifest.json").write_text('{"production_data": true, "fixture_data": true}')
    assert any("fixture" in error for error in validate_export_directory(data))


def test_health_export_uses_latest_status_and_clears_stale_reason(tmp_path) -> None:
    history = tmp_path / "history"
    ensure_history_files(history)
    connection = create_database(history, tmp_path / "test.duckdb")
    first = datetime(2026, 8, 4, 9, 0, tzinfo=timezone.utc)
    latest = datetime(2026, 8, 4, 10, 0, tzinfo=timezone.utc)
    connection.execute(
        """INSERT INTO source_runs VALUES
        ('run-1', 'stanford_memory_prices', ?, ?, 'degraded', 2, 0, 2, 200,
         'observation date is unreasonably far in the future', NULL, 1.0, false),
        ('run-2', 'stanford_memory_prices', ?, ?, 'success', 705, 703, 2, 200,
         '', '2026-07-01 00:00:00+00', 1.0, false),
        ('run-3', 'bestbuy_memory_products', ?, ?, 'disabled', 0, 0, 0, NULL,
         'Optional key is not configured', NULL, 0.0, false)""",
        [first, first, latest, latest, latest, latest],
    )
    data_dir = tmp_path / "data"
    export_frontend(connection, data_dir, {"spot_momentum": 1.0}, "test", "test_pipeline", True)
    connection.close()

    sources = {item["source_id"]: item for item in json.loads((data_dir / "source-health.json").read_text())["sources"]}
    stanford = sources["stanford_memory_prices"]
    assert stanford["status"] == "success"
    assert stanford["reason"] == ""
    assert stanford["records_collected"] == 703
    assert stanford["records_rejected"] == 4
    assert stanford["source_kind"] == "core"
    assert sources["bestbuy_memory_products"]["source_kind"] == "optional"
