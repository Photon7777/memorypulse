from __future__ import annotations

import hashlib
import json
import shutil
import tempfile
import zipfile
from datetime import date, datetime
from pathlib import Path
from typing import Any

import duckdb

from memorypulse.transformations.storage import atomic_write_text

DATASET_VERSION = "1.3.0"

PUBLIC_TABLES = {
    "memory_prices": {
        "filename": "memory_prices.csv",
        "description": "Normalized public memory-price observations with source attribution.",
        "date_column": "observation_date",
    },
    "spot_prices": {
        "filename": "spot_prices.csv",
        "description": "Permission-cleared public spot-price observations when available.",
        "date_column": "observation_date",
    },
    "retail_products": {
        "filename": "retail_products.csv",
        "description": "Optional normalized retail memory-product observations.",
        "date_column": "observation_date",
    },
    "electronics_prices": {
        "filename": "electronics_prices.csv",
        "description": "Official U.S. product-price milestones with configuration and comparability labels.",
        "date_column": "observation_date",
    },
    "device_exposure": {
        "filename": "device_exposure.csv",
        "description": "Documented scenario ranges for memory-and-storage cost exposure by device category.",
        "date_column": "category",
    },
    "industry_outlooks": {
        "filename": "industry_outlooks.csv",
        "description": "Sourced analyst outlooks with explicit horizons, metrics, numeric ranges where published, and qualitative direction elsewhere.",
        "date_column": "published_at",
    },
    "macro_indicators": {
        "filename": "macro_indicators.csv",
        "description": "Official semiconductor employment, producer-price, and trade-context indicators.",
        "date_column": "observation_date",
    },
    "news_events": {
        "filename": "news_events.ndjson",
        "description": "Bounded market-news and official policy metadata; no article bodies.",
        "date_column": "published_at",
    },
    "forecasts": {
        "filename": "forecasts.csv",
        "description": "Versioned governed forecasts with empirical uncertainty and rolling-backtest metrics.",
        "date_column": "target_date",
    },
    "structural_forecasts": {
        "filename": "structural_forecasts.csv",
        "description": "Market-informed 12–24 month DDR5 scenarios with transparent drivers, bounds, confidence, and source IDs.",
        "date_column": "target_date",
    },
    "market_index": {
        "filename": "market_index.csv",
        "description": "Memory Pressure Index history and component scores.",
        "date_column": "calculated_at",
    },
    "decision_briefs": {
        "filename": "decision_briefs.csv",
        "description": "Auditable conclusion and business-posture history for successful runs.",
        "date_column": "generated_at",
    },
    "source_runs": {
        "filename": "source_runs.csv",
        "description": "Per-source retrieval health, freshness, and record counts.",
        "date_column": "completed_at",
    },
}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _json_type(duckdb_type: str) -> dict[str, Any]:
    normalized = duckdb_type.upper()
    if normalized.endswith("[]"):
        return {"type": ["array", "null"], "items": {"type": "string"}}
    if "BOOL" in normalized:
        return {"type": ["boolean", "null"]}
    if any(name in normalized for name in ("INT", "HUGEINT")):
        return {"type": ["integer", "null"]}
    if any(name in normalized for name in ("DOUBLE", "FLOAT", "DECIMAL", "REAL")):
        return {"type": ["number", "null"]}
    return {"type": ["string", "null"]}


def _schema(connection: duckdb.DuckDBPyConnection, table: str) -> dict[str, Any]:
    columns = connection.execute(f"PRAGMA table_info('{table}')").fetchall()
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": f"https://photon7777.github.io/memorypulse/datasets/latest/schemas/{table}.schema.json",
        "title": f"MemoryPulse {table.replace('_', ' ')} row",
        "description": str(PUBLIC_TABLES[table]["description"]),
        "type": "object",
        "additionalProperties": False,
        "properties": {str(row[1]): _json_type(str(row[2])) for row in columns},
        "required": [str(row[1]) for row in columns],
    }


def _coverage(
    connection: duckdb.DuckDBPyConnection, table: str, date_column: str
) -> tuple[str | None, str | None]:
    start, end = connection.execute(
        f"SELECT min({date_column}), max({date_column}) FROM {table}"
    ).fetchone()
    return (
        start.isoformat() if isinstance(start, (date, datetime)) else None,
        end.isoformat() if isinstance(end, (date, datetime)) else None,
    )


def _source_ids(connection: duckdb.DuckDBPyConnection, table: str) -> list[str]:
    columns = {str(row[1]) for row in connection.execute(f"PRAGMA table_info('{table}')").fetchall()}
    if "source_id" not in columns:
        return []
    return [
        str(row[0])
        for row in connection.execute(
            f"SELECT DISTINCT source_id FROM {table} WHERE source_id IS NOT NULL ORDER BY source_id"
        ).fetchall()
    ]


def _write_json(path: Path, value: Any) -> None:
    atomic_write_text(
        path,
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True, default=str) + "\n",
    )


def build_public_dataset(
    connection: duckdb.DuckDBPyConnection,
    history_dir: Path,
    output_dir: Path,
    pipeline_run_id: str,
    generated_at: datetime,
    production_data: bool,
    repository_root: Path,
) -> dict[str, Any]:
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="memorypulse-dataset-", dir=output_dir.parent) as temporary:
        staging = Path(temporary) / "latest"
        csv_dir = staging / "csv"
        parquet_dir = staging / "parquet"
        schema_dir = staging / "schemas"
        csv_dir.mkdir(parents=True)
        parquet_dir.mkdir(parents=True)
        schema_dir.mkdir(parents=True)
        resources: list[dict[str, Any]] = []

        for table, config in PUBLIC_TABLES.items():
            canonical = history_dir / str(config["filename"])
            file_format = "ndjson" if canonical.suffix == ".ndjson" else "csv"
            text_target = csv_dir / canonical.name
            shutil.copy2(canonical, text_target)

            parquet_target = parquet_dir / f"{table}.parquet"
            escaped = str(parquet_target).replace("'", "''")
            connection.execute(
                f"COPY (SELECT * FROM {table}) TO '{escaped}' (FORMAT PARQUET, COMPRESSION ZSTD)"
            )
            schema_target = schema_dir / f"{table}.schema.json"
            _write_json(schema_target, _schema(connection, table))

            start_date, end_date = _coverage(connection, table, str(config["date_column"]))
            row_count = int(connection.execute(f"SELECT count(*) FROM {table}").fetchone()[0])
            common = {
                "dataset": table,
                "title": table.replace("_", " ").title(),
                "description": config["description"],
                "rows": row_count,
                "start_date": start_date,
                "end_date": end_date,
                "source_ids": _source_ids(connection, table),
                "schema_path": f"schemas/{table}.schema.json",
            }
            for artifact, format_name in ((text_target, file_format), (parquet_target, "parquet")):
                resources.append(
                    {
                        **common,
                        "id": f"{table}-{format_name}",
                        "format": format_name,
                        "path": artifact.relative_to(staging).as_posix(),
                        "bytes": artifact.stat().st_size,
                        "sha256": _sha256(artifact),
                    }
                )

        license_target = staging / "DATA_LICENSE.md"
        shutil.copy2(repository_root / "DATA_LICENSE.md", license_target)
        readme = staging / "README.txt"
        atomic_write_text(
            readme,
            "MemoryPulse public dataset\n"
            f"Version: {DATASET_VERSION}\n"
            f"Generated: {generated_at.isoformat()}\n\n"
            "CSV/NDJSON files preserve the canonical public contracts. Parquet files provide the same "
            "tables for analytical use. Review DATA_LICENSE.md, schemas/, and catalog.json before reuse.\n",
        )

        bundle_name = f"memorypulse-dataset-v{DATASET_VERSION}.zip"
        bundle = staging / bundle_name
        bundled_paths = [
            *sorted(csv_dir.iterdir()),
            *sorted(parquet_dir.iterdir()),
            *sorted(schema_dir.iterdir()),
            license_target,
            readme,
        ]
        with zipfile.ZipFile(bundle, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for path in bundled_paths:
                archive.write(path, path.relative_to(staging).as_posix())

        catalog = {
            "dataset_version": DATASET_VERSION,
            "schema_version": "1.0.0",
            "generated_at": generated_at.isoformat().replace("+00:00", "Z"),
            "pipeline_run_id": pipeline_run_id,
            "production_data": production_data,
            "name": "MemoryPulse Public Memory-Market Dataset",
            "description": "Normalized memory prices, official electronics price milestones, device-exposure assumptions, business context, forecasts, and auditable decision briefs.",
            "publisher": "MemoryPulse",
            "homepage": "https://photon7777.github.io/memorypulse/#/data",
            "repository": "https://github.com/Photon7777/memorypulse",
            "license": "Source-specific; see DATA_LICENSE.md",
            "attribution_required": True,
            "bundle": {
                "path": bundle.name,
                "format": "zip",
                "bytes": bundle.stat().st_size,
                "sha256": _sha256(bundle),
            },
            "resources": sorted(resources, key=lambda item: (item["dataset"], item["format"])),
        }
        _write_json(staging / "catalog.json", catalog)
        dataset_json = {
            "@context": "https://schema.org",
            "@type": "Dataset",
            "name": catalog["name"],
            "description": catalog["description"],
            "version": DATASET_VERSION,
            "dateModified": generated_at.date().isoformat(),
            "url": catalog["homepage"],
            "license": "https://photon7777.github.io/memorypulse/datasets/latest/DATA_LICENSE.md",
            "creator": {"@type": "Organization", "name": "MemoryPulse"},
            "distribution": [
                {
                    "@type": "DataDownload",
                    "encodingFormat": "application/zip",
                    "contentUrl": f"https://photon7777.github.io/memorypulse/datasets/latest/{bundle.name}",
                }
            ],
        }
        _write_json(staging / "dataset.json", dataset_json)

        checksum_paths = [*bundled_paths, bundle, staging / "dataset.json"]
        atomic_write_text(
            staging / "checksums.sha256",
            "".join(f"{_sha256(path)}  {path.relative_to(staging).as_posix()}\n" for path in checksum_paths),
        )

        if output_dir.exists():
            shutil.rmtree(output_dir)
        shutil.copytree(staging, output_dir)
    return catalog


def validate_public_dataset(output_dir: Path) -> list[str]:
    catalog_path = output_dir / "catalog.json"
    if not catalog_path.exists():
        return ["dataset catalog is missing"]
    try:
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return ["dataset catalog is not valid JSON"]
    errors: list[str] = []
    artifacts = [catalog.get("bundle", {}), *catalog.get("resources", [])]
    for artifact in artifacts:
        relative = artifact.get("path")
        if not relative:
            errors.append("dataset artifact path is missing")
            continue
        path = output_dir / str(relative)
        if not path.exists():
            errors.append(f"dataset artifact is missing: {relative}")
        elif artifact.get("sha256") != _sha256(path):
            errors.append(f"dataset checksum mismatch: {relative}")
    if not (output_dir / "checksums.sha256").exists():
        errors.append("dataset checksum manifest is missing")
    return errors
