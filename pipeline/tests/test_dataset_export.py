from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from memorypulse.database import create_database
from memorypulse.exports.dataset import build_public_dataset, validate_public_dataset
from memorypulse.transformations.storage import ensure_history_files


def test_public_dataset_has_catalog_schemas_bundle_and_checksums(tmp_path) -> None:
    history = tmp_path / "history"
    ensure_history_files(history)
    connection = create_database(history, tmp_path / "test.duckdb")
    output = tmp_path / "public/datasets/latest"
    repository = Path(__file__).resolve().parents[2]
    catalog = build_public_dataset(
        connection,
        history,
        output,
        "pipeline-test",
        datetime(2026, 8, 5, tzinfo=timezone.utc),
        False,
        repository,
    )
    connection.close()

    assert catalog["dataset_version"] == "1.3.0"
    assert len(catalog["resources"]) == 26
    assert any(resource["id"] == "structural_forecasts-parquet" for resource in catalog["resources"])
    assert (output / catalog["bundle"]["path"]).exists()
    assert (output / "parquet/memory_prices.parquet").exists()
    assert (output / "parquet/electronics_prices.parquet").exists()
    assert (output / "parquet/industry_outlooks.parquet").exists()
    schema = json.loads((output / "schemas/memory_prices.schema.json").read_text())
    assert "observation_id" in schema["properties"]
    assert validate_public_dataset(output) == []
