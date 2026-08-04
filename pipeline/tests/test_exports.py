from __future__ import annotations

import json

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


def test_fixture_publication_guard_is_detected(tmp_path) -> None:
    data = tmp_path / "data"
    data.mkdir()
    for name in (
        "market-summary.json", "prices.json", "retail.json", "news.json", "forecast.json",
        "source-health.json", "methodology.json",
    ):
        (data / name).write_text("{}")
    (data / "manifest.json").write_text('{"production_data": true, "fixture_data": true}')
    assert any("fixture" in error for error in validate_export_directory(data))
