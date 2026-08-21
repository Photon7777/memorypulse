from __future__ import annotations

import argparse
import calendar
import json
import logging
import os
import sys
import tempfile
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from memorypulse.analysis.evidence import build_evidence_readiness
from memorypulse.config import (
    free_only_enabled,
    indicator_config,
    repository_root,
    source_allowed_in_free_mode,
    source_config,
)
from memorypulse.database import create_database
from memorypulse.exports.dataset import build_public_dataset, validate_public_dataset
from memorypulse.exports.frontend import export_frontend
from memorypulse.forecasting.models import forecast_series
from memorypulse.forecasting.structural import STRUCTURAL_HORIZONS, build_structural_forecasts
from memorypulse.indicators.pressure import calculate_index, components_from_database
from memorypulse.models import (
    DecisionBriefObservation,
    MacroIndicatorObservation,
    NewsEvent,
    PriceObservation,
    RetailProductObservation,
    SourceRun,
    stable_id,
    utc_now,
)
from memorypulse.quality.report import (
    MAX_FRONTEND_FILE_BYTES,
    build_quality_report,
    validate_export_directory,
)
from memorypulse.sources import (
    BestBuyMemoryProductsSource,
    BlsSemiconductorEmploymentSource,
    CensusMemoryExportsSource,
    CensusMemoryImportsSource,
    DramExchangeHomepageSource,
    FederalRegisterSemiconductorSource,
    FredSemiconductorSource,
    GdeltMemoryNewsSource,
    KeepaDdr5PanelSource,
    SecMemorySupplierSource,
    StanfordMemoryPricesSource,
    WorldBankHighTechExportsSource,
)
from memorypulse.transformations.storage import (
    append_csv_records,
    append_news,
    ensure_history_files,
)

LOGGER = logging.getLogger("memorypulse")
ADAPTERS = {
    "stanford_memory_prices": StanfordMemoryPricesSource,
    "dramexchange_homepage": DramExchangeHomepageSource,
    "fred_semiconductor": FredSemiconductorSource,
    "bls_semiconductor_employment": BlsSemiconductorEmploymentSource,
    "world_bank_high_tech_exports": WorldBankHighTechExportsSource,
    "federal_register_semiconductor": FederalRegisterSemiconductorSource,
    "gdelt_memory_news": GdeltMemoryNewsSource,
    "bestbuy_memory_products": BestBuyMemoryProductsSource,
    "keepa_ddr5_panel": KeepaDdr5PanelSource,
    "census_memory_imports": CensusMemoryImportsSource,
    "census_memory_exports": CensusMemoryExportsSource,
    "sec_memory_supplier_fundamentals": SecMemorySupplierSource,
}
FIXTURES = {
    "stanford_memory_prices": "stanford_memory_prices.csv",
    "dramexchange_homepage": "dramexchange_homepage.html",
    "fred_semiconductor": "fred_semiconductor.csv",
    "bls_semiconductor_employment": "bls_semiconductor_employment.json",
    "world_bank_high_tech_exports": "world_bank_high_tech_exports.json",
    "federal_register_semiconductor": "federal_register_semiconductor.json",
    "gdelt_memory_news": "gdelt_news.json",
    "bestbuy_memory_products": "bestbuy_products.json",
    "keepa_ddr5_panel": "keepa_ddr5_panel.json",
    "census_memory_imports": "census_memory_imports.json",
    "census_memory_exports": "census_memory_exports.json",
    "sec_memory_supplier_fundamentals": "sec_companyfacts.json",
}


def _layout(output_root: Path, production: bool) -> tuple[Path, Path, Path]:
    if production:
        return output_root / "data/history", output_root / "frontend/public/data", output_root / "data/exports"
    return output_root / "data/history", output_root / "frontend/public/data", output_root / "data/exports"


def _next_month(value: date) -> date:
    year = value.year + (1 if value.month == 12 else 0)
    month = 1 if value.month == 12 else value.month + 1
    return date(year, month, min(value.day, calendar.monthrange(year, month)[1]))


def _add_months(value: date, months: int) -> date:
    result = value
    for _ in range(months):
        result = _next_month(result)
    return result


def _source_run(
    pipeline_run_id: str,
    source_id: str,
    started: datetime,
    status: str,
    received: int,
    written: int,
    rejected: int,
    response_status: int | None,
    failure_reason: str,
    freshness: datetime | None,
    optional_key: bool,
) -> SourceRun:
    completed = utc_now()
    return SourceRun(
        run_id=stable_id("run", pipeline_run_id, source_id),
        source_id=source_id,
        started_at=started,
        completed_at=completed,
        status=status,
        records_received=received,
        records_written=written,
        records_rejected=rejected,
        response_status=response_status,
        failure_reason=failure_reason,
        data_freshness_at=freshness,
        duration_seconds=max(0.0, (completed - started).total_seconds()),
        optional_key_configured=optional_key,
    )


def _append_records(history: Path, records: list[Any]) -> tuple[int, int]:
    if not records:
        return 0, 0
    first = records[0]
    if isinstance(first, PriceObservation):
        filename = "memory_prices.csv" if first.source_id == "stanford_memory_prices" else "spot_prices.csv"
        return append_csv_records(history / filename, records, "observation_id")
    if isinstance(first, MacroIndicatorObservation):
        return append_csv_records(history / "macro_indicators.csv", records, "observation_id")
    if isinstance(first, RetailProductObservation):
        return append_csv_records(history / "retail_products.csv", records, "observation_id")
    if isinstance(first, NewsEvent):
        return append_news(history / "news_events.ndjson", records)
    raise TypeError(f"unsupported normalized record type: {type(first)!r}")


def _generate_forecasts(connection: Any, history: Path, force: bool = False) -> int:
    latest_vintage = connection.execute("SELECT max(forecast_created_at) FROM forecasts").fetchone()[0]
    latest_structural = connection.execute(
        "SELECT max(forecast_created_at) FROM structural_forecasts"
    ).fetchone()[0]
    if latest_vintage and latest_structural and not force:
        comparable = latest_vintage.replace(tzinfo=timezone.utc) if latest_vintage.tzinfo is None else latest_vintage
        if comparable >= utc_now() - timedelta(days=7):
            return 0
    rows = connection.execute(
        """SELECT product_type, observation_date, avg(price_per_gb)
        FROM memory_prices WHERE price_per_gb IS NOT NULL
        GROUP BY product_type, observation_date ORDER BY product_type, observation_date"""
    ).fetchall()
    grouped: dict[str, list[tuple[date, float]]] = defaultdict(list)
    for series_id, observed, value in rows:
        grouped[str(series_id)].append((observed, float(value)))
    created_at = utc_now()
    forecasts = []
    structural_forecasts = []
    def annual_change(series_id: str) -> float | None:
        series_rows = connection.execute(
            """SELECT observation_date, value FROM macro_indicators
            WHERE series_id = ? ORDER BY observation_date""",
            [series_id],
        ).fetchall()
        if len(series_rows) < 13 or not series_rows[-13][1]:
            return None
        return 100 * (float(series_rows[-1][1]) / float(series_rows[-13][1]) - 1)

    macro_drivers = {
        "producer_price_change": annual_change("PCU3344133441"),
        "import_price_change": annual_change("IZ3344"),
        "capacity_utilization_change": annual_change("CAPUTLG3344S"),
    }
    evidence_readiness = build_evidence_readiness(connection)
    outlook_rows = connection.execute(
        """SELECT direction, source_id FROM industry_outlooks
        WHERE segment IN ('DRAM', 'DRAM + SSD') ORDER BY published_at DESC"""
    ).fetchall()
    expert_direction = "upward" if any(row[0] == "upward" for row in outlook_rows) else None
    expert_source_ids = [str(row[1]) for row in outlook_rows]
    for series_id, points in grouped.items():
        dates = [point[0] for point in points]
        values = [point[1] for point in points]
        for horizon in (1, 3, 6):
            result = forecast_series(
                series_id,
                dates,
                values,
                _add_months(max(dates), horizon),
                created_at=created_at,
                horizon=horizon,
            )
            if result:
                forecasts.append(result)
        if series_id == "DDR5 (Keepa)":
            structural_forecasts.extend(
                build_structural_forecasts(
                    series_id,
                    dates,
                    values,
                    created_at,
                    {horizon: _add_months(max(dates), horizon) for horizon in STRUCTURAL_HORIZONS},
                    macro_drivers,
                    expert_direction,
                    expert_source_ids,
                    evidence_readiness,
                )
            )
    written, _ = append_csv_records(
        history / "forecasts.csv", forecasts, ("forecast_created_at", "series_id", "target_date")
    )
    structural_written, _ = append_csv_records(
        history / "structural_forecasts.csv",
        structural_forecasts,
        ("forecast_created_at", "series_id", "scenario", "target_date"),
    )
    return written + structural_written


def run_update(offline: bool, output_root: Path | None, force_forecast: bool = False) -> None:
    repo = repository_root()
    root = output_root.resolve() if output_root else repo
    history, frontend_data, exports_dir = _layout(root, not offline)
    ensure_history_files(history)
    pipeline_run_id = stable_id("pipeline", utc_now().isoformat(), "offline" if offline else "production")
    configs = source_config(repo)
    free_only = free_only_enabled(repo)
    fixture_dir = repo / "pipeline/tests/fixtures"
    source_runs: list[SourceRun] = []
    successful_core_source = False
    for source_id, adapter_type in ADAPTERS.items():
        config = dict(configs[source_id])
        if offline:
            config["enabled"] = True
        elif free_only and not source_allowed_in_free_mode(config):
            config["enabled"] = False
            config["disabled_reason"] = (
                "Excluded by the free-only public-pipeline policy; fixtures may still exercise this adapter."
            )
        adapter = adapter_type(config, repo)
        started = utc_now()
        fixture = fixture_dir / FIXTURES[source_id] if offline else None
        records, health = adapter.run(fixture)
        written = rejected = 0
        status = health.status
        reason = health.reason
        try:
            written, rejected = _append_records(history, records)
            if status == "success" and source_id in {"stanford_memory_prices", "fred_semiconductor"}:
                successful_core_source = True
        except Exception as error:
            status = "degraded"
            reason = f"history write rejected: {error}"[:500]
        source_runs.append(
            _source_run(
                pipeline_run_id,
                source_id,
                started,
                status,
                health.records_received,
                written,
                rejected + health.records_rejected,
                health.response_status,
                reason,
                health.freshness_at,
                bool(os.getenv(str(config.get("requires_env", "")))) if config.get("requires_env") else False,
            )
        )
    append_csv_records(history / "source_runs.csv", source_runs, "run_id")
    if not offline and not successful_core_source:
        raise RuntimeError("No real core public source completed; previous website data was left unchanged")

    with tempfile.TemporaryDirectory(prefix="memorypulse-") as temporary:
        database_path = Path(temporary) / "memorypulse.duckdb"
        connection = create_database(history, database_path)
        indicator = indicator_config(repo)
        components = components_from_database(connection)
        latest = connection.execute(
            "SELECT max(observation_date) FROM (SELECT observation_date FROM memory_prices UNION ALL SELECT observation_date FROM spot_prices UNION ALL SELECT observation_date FROM macro_indicators)"
        ).fetchone()[0]
        index = calculate_index(components, indicator["weights"], indicator["methodology_version"], latest or date.today())
        append_csv_records(history / "market_index.csv", [index.observation], "calculated_at")
        connection.close()

        connection = create_database(history, database_path)
        _generate_forecasts(connection, history, force_forecast)
        connection.close()

        connection = create_database(history, database_path)
        exports_dir.mkdir(parents=True, exist_ok=True)
        report = build_quality_report(connection, exports_dir / "quality-report.json", not offline)
        if report["status"] != "pass":
            raise RuntimeError("data-quality validation failed; frontend exports were not replaced")
        manifest = export_frontend(
            connection,
            frontend_data,
            indicator["weights"],
            indicator["methodology_version"],
            pipeline_run_id,
            production_data=not offline,
        )
        connection.close()
        brief_document = json.loads((frontend_data / "decision-brief.json").read_text(encoding="utf-8"))
        posture = brief_document["recommended_posture"]
        append_csv_records(
            history / "decision_briefs.csv",
            [
                DecisionBriefObservation(
                    brief_id=brief_document["brief_id"],
                    generated_at=datetime.fromisoformat(brief_document["generated_at"].replace("Z", "+00:00")),
                    regime=brief_document["regime"],
                    direction=brief_document["direction"],
                    confidence=brief_document["confidence"],
                    confidence_score=float(brief_document["confidence_score"]),
                    pressure_score=float(brief_document["pressure_score"]),
                    procurement_posture=posture["procurement"],
                    inventory_posture=posture["inventory"],
                    budget_risk=posture["budget_risk"],
                    conclusion=brief_document["conclusion"],
                    methodology_version=indicator["methodology_version"],
                )
            ],
            "brief_id",
        )
        connection = create_database(history, database_path)
        build_public_dataset(
            connection,
            history,
            frontend_data.parent / "datasets/latest",
            pipeline_run_id,
            manifest["generated_at"],
            not offline,
            repo,
        )
        build_quality_report(connection, exports_dir / "quality-report.json", not offline)
        connection.close()
    errors = validate_export_directory(frontend_data, expect_production=not offline)
    errors.extend(validate_public_dataset(frontend_data.parent / "datasets/latest"))
    if errors:
        raise RuntimeError("export validation failed: " + "; ".join(errors))
    print(f"MemoryPulse {'offline fixture' if offline else 'production'} update complete: {pipeline_run_id}")


def run_export(production: bool) -> None:
    repo = repository_root()
    history, frontend_data, exports_dir = _layout(repo, production)
    ensure_history_files(history)
    with tempfile.TemporaryDirectory(prefix="memorypulse-") as temporary:
        connection = create_database(history, Path(temporary) / "memorypulse.duckdb")
        indicator = indicator_config(repo)
        run_id = stable_id("export", utc_now().isoformat())
        build_quality_report(connection, exports_dir / "quality-report.json", production)
        manifest = export_frontend(
            connection,
            frontend_data,
            indicator["weights"],
            indicator["methodology_version"],
            run_id,
            production_data=production,
        )
        build_public_dataset(
            connection,
            history,
            frontend_data.parent / "datasets/latest",
            run_id,
            manifest["generated_at"],
            production,
            repo,
        )
        connection.close()


def run_dataset(production: bool) -> None:
    repo = repository_root()
    history, frontend_data, _ = _layout(repo, production)
    ensure_history_files(history)
    with tempfile.TemporaryDirectory(prefix="memorypulse-") as temporary:
        connection = create_database(history, Path(temporary) / "memorypulse.duckdb")
        build_public_dataset(
            connection,
            history,
            frontend_data.parent / "datasets/latest",
            stable_id("dataset", utc_now().isoformat()),
            utc_now(),
            production,
            repo,
        )
        connection.close()


def run_validate(root: Path | None) -> None:
    base = root.resolve() if root else repository_root()
    data_dir = base / "frontend/public/data"
    errors = validate_export_directory(data_dir, expect_production=None if root else True)
    errors.extend(validate_public_dataset(base / "frontend/public/datasets/latest"))
    if errors:
        raise RuntimeError("validation failed: " + "; ".join(errors))
    print(f"Validated static data in {data_dir}")


def check_size() -> None:
    repo = repository_root()
    warnings = []
    for path in (repo / "frontend/public/data").glob("*.json"):
        if path.stat().st_size > MAX_FRONTEND_FILE_BYTES:
            warnings.append(f"{path.name}: {path.stat().st_size} bytes")
    history_total = sum(path.stat().st_size for path in (repo / "data/history").glob("*"))
    dataset_total = sum(
        path.stat().st_size
        for path in (repo / "frontend/public/datasets/latest").rglob("*")
        if path.is_file()
    )
    if dataset_total > 25 * 1024 * 1024:
        warnings.append(f"public dataset: {dataset_total} bytes")
    report = {
        "frontend_warnings": warnings,
        "history_bytes": history_total,
        "dataset_bytes": dataset_total,
    }
    print(json.dumps(report, sort_keys=True))
    if warnings:
        raise RuntimeError("generated frontend data exceeded the configured size threshold")


def compact_monthly(output: Path | None) -> None:
    repo = repository_root()
    target = (output or repo / "data/exports/monthly-memory-prices.parquet").resolve()
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="memorypulse-") as temporary:
        connection = create_database(repo / "data/history", Path(temporary) / "memorypulse.duckdb")
        escaped = str(target).replace("'", "''")
        connection.execute(
            f"COPY (SELECT * FROM monthly_memory_prices ORDER BY month, source_id, product_type) "
            f"TO '{escaped}' (FORMAT PARQUET, COMPRESSION ZSTD)"
        )
        connection.close()
    print(f"Wrote optional monthly Parquet compaction to {target}")


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="MemoryPulse data pipeline")
    subparsers = result.add_subparsers(dest="command", required=True)
    update = subparsers.add_parser("update", help="collect sources, transform, forecast, and export")
    update.add_argument("--offline", action="store_true", help="use lawful local fixtures")
    update.add_argument("--output-root", type=Path)
    update.add_argument("--force-forecast", action="store_true")
    export = subparsers.add_parser("export", help="rebuild frontend JSON from canonical history")
    export.add_argument("--production", action="store_true")
    dataset = subparsers.add_parser("dataset", help="build the versioned public dataset release")
    dataset.add_argument("--production", action="store_true")
    validate = subparsers.add_parser("validate", help="validate generated frontend contracts")
    validate.add_argument("--root", type=Path)
    subparsers.add_parser("check-size", help="enforce repository growth limits")
    compact = subparsers.add_parser("compact", help="write an optional monthly Parquet analytical export")
    compact.add_argument("--output", type=Path)
    return result


def main(argv: list[str] | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    args = parser().parse_args(argv)
    try:
        if args.command == "update":
            run_update(args.offline, args.output_root, args.force_forecast)
        elif args.command == "export":
            run_export(args.production)
        elif args.command == "dataset":
            run_dataset(args.production)
        elif args.command == "validate":
            run_validate(args.root)
        elif args.command == "check-size":
            check_size()
        elif args.command == "compact":
            compact_monthly(args.output)
    except Exception as error:
        LOGGER.error("%s", error)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main(sys.argv[1:])
