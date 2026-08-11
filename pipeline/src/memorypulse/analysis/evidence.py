from __future__ import annotations

from typing import Any

import duckdb

LONG_RANGE_MONTHS_REQUIRED = 48
DIRECT_SOURCES_REQUIRED = 2
RETAIL_PRODUCTS_REQUIRED = 15
DRIVER_FAMILIES_REQUIRED = 3


def build_evidence_readiness(connection: duckdb.DuckDBPyConnection) -> dict[str, Any]:
    """Measure whether the DDR5 evidence supports scenarios or a governed long-range model.

    Row volume alone is not treated as readiness. The score rewards time depth, independent
    direct-price sources, a stable retail product panel, and distinct official driver families.
    """
    history = connection.execute(
        """SELECT count(DISTINCT date_trunc('month', observation_date)),
        min(observation_date), max(observation_date), count(DISTINCT product_type),
        count(DISTINCT source_id)
        FROM memory_prices
        WHERE memory_generation = 'DDR5' AND price_per_gb IS NOT NULL"""
    ).fetchone()
    retail = connection.execute(
        """SELECT count(DISTINCT sku),
        count(DISTINCT date_trunc('month', observation_date)),
        count(DISTINCT source_id)
        FROM retail_products
        WHERE generation = 'DDR5' AND price_per_gb IS NOT NULL AND parsing_confidence >= 0.7"""
    ).fetchone()
    macro_rows = connection.execute(
        "SELECT DISTINCT source_id, series_id FROM macro_indicators"
    ).fetchall()

    ddr5_months = int(history[0] or 0)
    retail_products = int(retail[0] or 0)
    retail_months = int(retail[1] or 0)
    direct_sources = int(history[4] or 0) + int(retail[2] or 0)
    series_ids = {str(row[1]) for row in macro_rows}
    source_ids = {str(row[0]) for row in macro_rows}
    driver_families = {
        family
        for family, present in {
            "official_prices": bool(
                series_ids.intersection({"PCU3344133441", "PCU33443344", "IZ3344"})
            ),
            "production_capacity": bool(
                series_ids.intersection({"IPG3344S", "CAPUTLG3344S"})
            ),
            "supplier_fundamentals": "sec_memory_supplier_fundamentals" in source_ids,
            "memory_trade": bool(
                source_ids.intersection({"census_memory_imports", "census_memory_exports"})
            ),
        }.items()
        if present
    }

    history_score = min(ddr5_months / 60, 1.0)
    source_score = min(direct_sources / 3, 1.0)
    product_score = min(retail_products / 30, 1.0)
    driver_score = min(len(driver_families) / 4, 1.0)
    score = round(100 * (
        0.40 * history_score
        + 0.20 * source_score
        + 0.20 * product_score
        + 0.20 * driver_score
    ), 1)

    panel_ready = retail_products >= RETAIL_PRODUCTS_REQUIRED and retail_months >= 24
    long_range_ready = (
        ddr5_months >= LONG_RANGE_MONTHS_REQUIRED
        and direct_sources >= DIRECT_SOURCES_REQUIRED
        and retail_products >= RETAIL_PRODUCTS_REQUIRED
        and len(driver_families) >= DRIVER_FAMILIES_REQUIRED
    )
    if long_range_ready:
        status = "statistical_ready"
        label = "Long-range model ready"
    elif ddr5_months >= 36 or retail_products >= 5:
        status = "panel_building"
        label = "Evidence panel building"
    else:
        status = "scenario_only"
        label = "Scenario evidence only"

    blockers = []
    if ddr5_months < LONG_RANGE_MONTHS_REQUIRED:
        blockers.append(
            f"{LONG_RANGE_MONTHS_REQUIRED - ddr5_months} more comparable monthly DDR5 observations"
        )
    if direct_sources < DIRECT_SOURCES_REQUIRED:
        blockers.append(
            f"{DIRECT_SOURCES_REQUIRED - direct_sources} additional independent direct-price source"
        )
    if retail_products < RETAIL_PRODUCTS_REQUIRED:
        blockers.append(
            f"{RETAIL_PRODUCTS_REQUIRED - retail_products} additional stable retail products"
        )
    if len(driver_families) < DRIVER_FAMILIES_REQUIRED:
        blockers.append(
            f"{DRIVER_FAMILIES_REQUIRED - len(driver_families)} additional official driver family"
        )

    return {
        "score": score,
        "status": status,
        "label": label,
        "ddr5_months": ddr5_months,
        "history_start": history[1],
        "history_end": history[2],
        "direct_series": int(history[3] or 0),
        "direct_sources": direct_sources,
        "retail_products": retail_products,
        "retail_months": retail_months,
        "driver_families": sorted(driver_families),
        "driver_family_count": len(driver_families),
        "short_term_ready": ddr5_months >= 12,
        "panel_ready": panel_ready,
        "long_range_statistical_ready": long_range_ready,
        "thresholds": {
            "ddr5_months": LONG_RANGE_MONTHS_REQUIRED,
            "direct_sources": DIRECT_SOURCES_REQUIRED,
            "retail_products": RETAIL_PRODUCTS_REQUIRED,
            "driver_families": DRIVER_FAMILIES_REQUIRED,
        },
        "blockers": blockers,
        "explanation": (
            "Long-range statistical forecasting stays gated until the project has sufficient "
            "time depth, independent direct-price coverage, stable retail products, and official drivers."
        ),
    }
