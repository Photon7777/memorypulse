from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from typing import Any

import duckdb

from memorypulse.analysis.evidence import build_evidence_readiness
from memorypulse.forecasting.models import MODELS, rolling_origin_backtest
from memorypulse.indicators.pressure import IndexResult
from memorypulse.models import stable_id

COMPONENT_LABELS = {
    "spot_momentum": "Memory price momentum",
    "retail_momentum": "Retail module momentum",
    "volatility": "Price volatility",
    "news_pressure": "Market-event intensity",
    "macro_pressure": "Producer-cost pressure",
}


def _rows(connection: duckdb.DuckDBPyConnection, query: str) -> list[dict[str, Any]]:
    result = connection.execute(query)
    columns = [description[0] for description in result.description]
    return [dict(zip(columns, row, strict=True)) for row in result.fetchall()]


def _latest_ddr5_price(connection: duckdb.DuckDBPyConnection) -> tuple[float | None, str | None]:
    row = connection.execute(
        """SELECT avg(price_per_gb), observation_date
        FROM memory_prices WHERE memory_generation = 'DDR5' AND price_per_gb IS NOT NULL
        GROUP BY observation_date ORDER BY observation_date DESC LIMIT 1"""
    ).fetchone()
    return (float(row[0]), row[1].isoformat()) if row else (None, None)


def _latest_ddr5_forecast(connection: duckdb.DuckDBPyConnection) -> dict[str, Any] | None:
    rows = _rows(
        connection,
        """SELECT forecast_created_at, target_date, series_id, model_name, point_forecast,
        lower_bound, upper_bound, backtest_mae, backtest_mape, observations_used
        FROM forecasts WHERE series_id LIKE 'DDR5%'
        QUALIFY forecast_created_at = max(forecast_created_at) OVER ()
        ORDER BY target_date LIMIT 1""",
    )
    return rows[0] if rows else None


def _latest_ddr5_structural(connection: duckdb.DuckDBPyConnection) -> dict[str, Any] | None:
    rows = _rows(
        connection,
        """SELECT forecast_created_at, target_date, series_id, scenario, model_name,
        point_forecast, lower_bound, upper_bound, baseline_value,
        change_from_baseline_percent, direction, confidence, driver_summary, basis, source_ids
        FROM structural_forecasts WHERE series_id LIKE 'DDR5%' AND scenario = 'base'
        QUALIFY forecast_created_at = max(forecast_created_at) OVER ()
        ORDER BY target_date DESC LIMIT 1""",
    )
    return rows[0] if rows else None


def _confidence_label(value: float, has_forecast: bool) -> str:
    adjusted = value if has_forecast else value * 0.8
    if adjusted >= 0.85:
        return "High"
    if adjusted >= 0.55:
        return "Medium"
    return "Low"


def _direction(
    recent_change: float | None,
    forecast_change: float | None,
    structural_change: float | None = None,
) -> str:
    if structural_change is not None and structural_change > 2:
        if recent_change is not None and recent_change < -2:
            return "Mixed signals"
        return "Upward risk"
    if recent_change is not None and forecast_change is not None:
        recent_direction = 0 if abs(recent_change) < 2 else 1 if recent_change > 0 else -1
        forecast_direction = 0 if abs(forecast_change) < 2 else 1 if forecast_change > 0 else -1
        if recent_direction != forecast_direction:
            return "Mixed signals"
    signal = forecast_change if forecast_change is not None and abs(forecast_change) >= 2 else recent_change
    if signal is None or abs(signal) < 2:
        return "Broadly stable"
    return "Upward risk" if signal > 0 else "Downward bias"


def _regime(score: float, direction: str, coverage: float) -> str:
    if coverage < 0.35:
        return "Watch"
    if score >= 75:
        return "High pressure"
    if score >= 50 or direction == "Upward risk":
        return "Tightening"
    if score < 25 and direction == "Downward bias":
        return "Easing"
    return "Stable"


def _postures(regime: str, direction: str) -> tuple[str, str, str]:
    if regime == "Watch":
        return "Maintain plan pending confirmation", "Review signals without changing policy", "Unconfirmed"
    if regime == "High pressure":
        return "Protect critical demand", "Raise safety-stock review", "High"
    if regime == "Tightening" or direction == "Upward risk":
        return "Stagger near-term purchases", "Maintain or selectively add buffer", "Moderate"
    if regime == "Easing" or direction == "Downward bias":
        return "Use phased purchasing", "Avoid excess buffer until the decline stabilizes", "Low"
    return "Maintain planned purchasing", "Hold current safety-stock policy", "Low to moderate"


def build_decision_brief(
    connection: duckdb.DuckDBPyConnection,
    index_result: IndexResult,
    weights: dict[str, float],
    key_changes: dict[str, float | None],
    generated_at: datetime,
) -> dict[str, Any]:
    index = index_result.observation
    latest_price, price_date = _latest_ddr5_price(connection)
    forecast = _latest_ddr5_forecast(connection)
    structural = _latest_ddr5_structural(connection)
    forecast_change = (
        100 * (float(forecast["point_forecast"]) / latest_price - 1)
        if forecast and latest_price
        else None
    )
    recent_change = key_changes.get("ddr5_recent_change")
    structural_change = float(structural["change_from_baseline_percent"]) if structural else None
    direction = _direction(recent_change, forecast_change, structural_change)
    regime = _regime(index.total_score, direction, index.confidence_score)
    procurement, inventory, budget_risk = _postures(regime, direction)
    confidence = _confidence_label(index.confidence_score, forecast is not None)

    available = [component for component in index_result.components if component.score is not None]
    represented = sum(weights.get(component.key, 0.0) for component in available) or 1.0
    drivers = []
    for component in sorted(
        available,
        key=lambda item: abs(float(item.score or 50) - 50) * weights.get(item.key, 0.0),
        reverse=True,
    )[:3]:
        score = float(component.score or 0)
        effect = "tightening" if score >= 55 else "easing" if score <= 45 else "neutral"
        drivers.append(
            {
                "key": component.key,
                "label": COMPONENT_LABELS.get(component.key, component.key.replace("_", " ")),
                "score": round(score, 1),
                "effect": effect,
                "contribution": round(score * weights.get(component.key, 0.0) / represented, 2),
                "evidence": component.raw_inputs,
            }
        )

    missing = [COMPONENT_LABELS.get(item.key, item.key) for item in index_result.components if item.score is None]
    risks = []
    if missing:
        risks.append(f"Missing comparable history for {', '.join(missing)} lowers confidence.")
    if forecast:
        interval_width = float(forecast["upper_bound"]) - float(forecast["lower_bound"])
        risks.append(f"The next DDR5 forecast interval spans {interval_width:.2f} source-defined units.")
    else:
        risks.append("No eligible DDR5 forecast is available; the posture relies on observed signals only.")
    if structural:
        risks.append(
            f"The 24-month base case is {structural_change:.1f}% from the latest DDR5 value, "
            f"with {str(structural['confidence']).lower()} confidence and explicit easing and tight-supply alternatives."
        )
    risks.append("Public data can lag supplier negotiations and private contract pricing.")

    previous = connection.execute(
        "SELECT total_score FROM market_index ORDER BY calculated_at DESC LIMIT 2"
    ).fetchall()
    index_change = float(previous[0][0] - previous[1][0]) if len(previous) > 1 else None
    changes = [
        {
            "label": "Pressure index",
            "value": round(index_change, 2) if index_change is not None else None,
            "unit": "points since prior run",
        },
        {
            "label": "DDR5 latest interval",
            "value": round(float(recent_change), 2) if recent_change is not None else None,
            "unit": "%",
        },
        {
            "label": "Model-implied DDR5 move",
            "value": round(forecast_change, 2) if forecast_change is not None else None,
            "unit": "% to next target",
        },
        {
            "label": "24-month structural base",
            "value": round(structural_change, 2) if structural_change is not None else None,
            "unit": "% vs latest observation",
        },
    ]
    conclusion = (
        f"{regime} conditions with {direction.lower()} and {confidence.lower()} confidence. "
        + (f"The market-informed 24-month DDR5 base case is {structural_change:.1f}% versus the latest observation. " if structural_change is not None else "")
        + f"The analytical procurement posture is to {procurement.lower()}, while the inventory posture is to "
        f"{inventory.lower()}. Budget exposure is {budget_risk.lower()}."
    )
    return {
        "brief_id": stable_id("brief", generated_at.isoformat(), regime, direction),
        "generated_at": generated_at,
        "regime": regime,
        "direction": direction,
        "confidence": confidence,
        "confidence_score": index.confidence_score,
        "pressure_score": index.total_score,
        "headline": f"{regime}: {procurement}",
        "conclusion": conclusion,
        "recommended_posture": {
            "procurement": procurement,
            "inventory": inventory,
            "budget_risk": budget_risk,
        },
        "drivers": drivers,
        "risks": risks,
        "changes": changes,
        "ddr5": {
            "latest_price_per_gb": latest_price,
            "latest_observation": price_date,
            "recent_change_percent": recent_change,
            "forecast_change_percent": forecast_change,
            "forecast": forecast,
            "structural_change_percent": structural_change,
            "structural_forecast": structural,
        },
        "method": "Deterministic rules over validated index components, a horizon-specific rolling-origin forecast, and a separately labeled 12–24 month market-driver scenario ensemble.",
        "disclaimer": "Analytical decision support only—not purchasing, investment, or inventory-management advice.",
    }


def _macro_series(connection: duckdb.DuckDBPyConnection) -> list[dict[str, Any]]:
    rows = _rows(
        connection,
        """SELECT observation_date, source_id, series_id, series_name, value, unit, source_url
        FROM macro_indicators ORDER BY series_id, observation_date""",
    )
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    metadata: dict[str, dict[str, Any]] = {}
    for row in rows:
        grouped[str(row["series_id"])].append({"date": row["observation_date"], "value": row["value"]})
        metadata[str(row["series_id"])] = {
            "series_id": row["series_id"],
            "name": row["series_name"],
            "unit": row["unit"],
            "source_id": row["source_id"],
            "source_url": row["source_url"],
        }
    output = []
    for series_id, points in grouped.items():
        latest = points[-1]
        previous = points[-2] if len(points) > 1 else None
        change = (
            100 * (float(latest["value"]) / float(previous["value"]) - 1)
            if previous and previous["value"]
            else None
        )
        output.append(
            {
                **metadata[series_id],
                "latest": latest,
                "change_percent": change,
                "observations": len(points),
                "points": points,
            }
        )
    return output


def _model_diagnostics(connection: duckdb.DuckDBPyConnection) -> list[dict[str, Any]]:
    rows = connection.execute(
        """SELECT product_type, observation_date, avg(price_per_gb)
        FROM memory_prices WHERE memory_generation IN ('DDR4', 'DDR5') AND price_per_gb IS NOT NULL
        GROUP BY product_type, observation_date ORDER BY product_type, observation_date"""
    ).fetchall()
    grouped: dict[str, list[float]] = defaultdict(list)
    for series_id, _, value in rows:
        grouped[str(series_id)].append(float(value))
    output = []
    for series_id, values in grouped.items():
        if len(values) < 12:
            continue
        results = [rolling_origin_backtest(values, name) for name in MODELS]
        eligible = [result for result in results if result.mae != float("inf") and result.stability >= 0.75]
        if not eligible:
            continue
        naive = next(result for result in results if result.name == "naive_last_value")
        best = min(eligible, key=lambda result: (result.mae, result.name != "naive_last_value"))
        selected = best.name if best.name == "naive_last_value" or best.mae <= naive.mae * 0.98 else naive.name
        output.append(
            {
                "series_id": series_id,
                "observations": len(values),
                "selected_model": selected,
                "advanced_ml_ready": len(values) >= 48,
                "selection_rule": "Lowest stable rolling-origin MAE; complex models must beat naive by at least 2%.",
                "candidates": [
                    {
                        "model": result.name,
                        "mae": result.mae,
                        "mape": result.mape,
                        "smape": result.smape,
                        "mase": result.mase,
                        "direction_accuracy": result.direction_accuracy,
                        "validation_points": result.validation_points,
                        "stability": result.stability,
                        "skill_vs_naive_percent": (
                            100 * (1 - result.mae / naive.mae)
                            if naive.mae and naive.mae != float("inf") and result.mae != float("inf")
                            else None
                        ),
                        "selected": result.name == selected,
                    }
                    for result in sorted(results, key=lambda item: item.mae)
                ],
            }
        )
    return output


def build_electronics_story(
    connection: duckdb.DuckDBPyConnection,
    decision_brief: dict[str, Any],
) -> dict[str, Any]:
    milestones = _rows(
        connection,
        """SELECT observation_id, observation_date, category, manufacturer, product_family,
        model, configuration, price_type, price_usd, memory_gb, storage_gb, comparability,
        source_id, source_url, source_label, notes, change_from_first_percent
        FROM electronics_price_changes ORDER BY observation_date, product_family""",
    )
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in milestones:
        grouped[str(item["product_family"])].append(item)
    series = []
    for family, points in grouped.items():
        first, latest = points[0], points[-1]
        series.append(
            {
                "family": family,
                "category": latest["category"],
                "manufacturer": latest["manufacturer"],
                "comparability": latest["comparability"],
                "first_price": first["price_usd"],
                "latest_price": latest["price_usd"],
                "change_percent": 100 * (float(latest["price_usd"]) / float(first["price_usd"]) - 1),
                "first_date": first["observation_date"],
                "latest_date": latest["observation_date"],
                "points": points,
            }
        )
    series.sort(key=lambda item: abs(float(item["change_percent"])), reverse=True)

    signal = decision_brief.get("ddr5", {}).get("forecast_change_percent")
    if signal is None or abs(float(signal)) < 0.01:
        signal = decision_brief.get("ddr5", {}).get("recent_change_percent")
    signal = float(signal or 0)
    exposures = _rows(connection, "SELECT * FROM device_exposure ORDER BY memory_storage_share_central DESC")
    scenarios = []
    for item in exposures:
        scenarios.append(
            {
                **item,
                "signal_percent": signal,
                "modeled_product_effect_low": signal * float(item["memory_storage_share_low"]) * float(item["pass_through_low"]),
                "modeled_product_effect_central": signal * float(item["memory_storage_share_central"]) * float(item["pass_through_central"]),
                "modeled_product_effect_high": signal * float(item["memory_storage_share_high"]) * float(item["pass_through_high"]),
            }
        )

    family_lookup = {item["family"]: item for item in series}
    ps5_change = float(family_lookup.get("PlayStation 5 standard", {}).get("change_percent", 0))
    xbox_change = float(family_lookup.get("Xbox Series X", {}).get("change_percent", 0))
    switch_change = float(family_lookup.get("Nintendo Switch 2", {}).get("change_percent", 0))
    air_change = float(family_lookup.get("MacBook Air entry tier", {}).get("change_percent", 0))
    pro_change = float(family_lookup.get("MacBook Pro entry tier", {}).get("change_percent", 0))
    return {
        "headline": "The component squeeze is reaching finished electronics—but not in the same way.",
        "thesis": (
            f"Official U.S. milestones put PS5 and Xbox Series X prices about {ps5_change:.0f}% and "
            f"{xbox_change:.0f}% above launch. Nintendo has announced a {switch_change:.0f}% Switch 2 "
            "increase. MacBook starting tiers also moved, but specification changes make causal comparisons weaker."
        ),
        "memory_signal_percent": signal,
        "product_series": series,
        "milestones": milestones,
        "exposure_scenarios": scenarios,
        "evidence": [
            {
                "kind": "observed",
                "label": "PS5 standard",
                "value": ps5_change,
                "unit": "% from launch MSRP",
                "interpretation": "An official same-family console price path; memory is one possible contributor among several.",
            },
            {
                "kind": "observed",
                "label": "Xbox Series X",
                "value": xbox_change,
                "unit": "% from launch ERP",
                "interpretation": "Microsoft explicitly cited higher console memory and storage costs in its 2026 update.",
            },
            {
                "kind": "qualified",
                "label": "MacBook Air entry tier",
                "value": air_change,
                "unit": "% since 2020",
                "interpretation": "Starting price increased, while memory, storage, and processor capability also changed materially.",
            },
            {
                "kind": "qualified",
                "label": "MacBook Pro entry tier",
                "value": pro_change,
                "unit": "% since 2020",
                "interpretation": "A product-tier comparison—not a like-for-like price index.",
            },
        ],
        "story": {
            "proves": [
                "Major console makers have published substantial U.S. list-price increases.",
                "The latest public DDR5 series and official semiconductor indicators show measurable component-market movement.",
                "Product pricing differs materially by configuration and commercial model.",
            ],
            "suggests": [
                "Memory-intensive and lower-margin devices can have greater exposure when component pressure persists.",
                "Configurable PCs may transmit component changes faster than fixed-platform products.",
                "Manufacturers may respond through price, configuration, promotions, margins, or launch timing.",
            ],
            "uncertain": [
                "Public evidence does not isolate memory as the sole cause of any finished-product price change.",
                "Supplier contracts, tariffs, exchange rates, logistics, and product redesign are not fully observable.",
                "MacBook generations are not directly comparable without quality adjustment.",
            ],
            "would_change_view": [
                "A sustained reversal in observed DDR5 prices and producer-cost pressure.",
                "Official price reductions or higher-capacity configurations at unchanged prices.",
                "Forecast underperformance versus naive baselines over new observed vintages.",
            ],
        },
        "conclusion": (
            "Console price escalation is directly observable; laptop pricing is a configuration-adjusted story. "
            "Memory pressure is a credible cost channel, not a complete causal explanation. The most defensible "
            "forward view is therefore a range of product-cost exposure rather than a promised retail-price forecast."
        ),
        "disclaimer": "Official price milestones and transparent scenarios; not a causal estimate or retail-price guarantee.",
    }


def _pressure_history(connection: duckdb.DuckDBPyConnection) -> list[dict[str, Any]]:
    return _rows(
        connection,
        """SELECT calculated_at AS date, total_score, confidence_score,
        spot_momentum_score, retail_momentum_score, volatility_score,
        news_pressure_score, macro_pressure_score, status_label
        FROM market_index ORDER BY calculated_at""",
    )


def _momentum_matrix(connection: duckdb.DuckDBPyConnection) -> list[dict[str, Any]]:
    rows = connection.execute(
        """SELECT product_type, memory_generation, observation_date, avg(price_per_gb)
        FROM memory_prices WHERE memory_generation IN ('DDR3', 'DDR4', 'DDR5', 'HBM', 'NAND')
          AND price_per_gb IS NOT NULL
        GROUP BY product_type, memory_generation, observation_date
        ORDER BY product_type, observation_date"""
    ).fetchall()
    grouped: dict[tuple[str, str], list[tuple[date, float]]] = defaultdict(list)
    for series_id, generation, observed, value in rows:
        grouped[(str(series_id), str(generation))].append((observed, float(value)))
    output: list[dict[str, Any]] = []
    for (series_id, generation), points in grouped.items():
        if len(points) < 2:
            continue
        for horizon in (1, 3, 6, 12):
            if len(points) <= horizon or not points[-1 - horizon][1]:
                continue
            output.append(
                {
                    "series_id": series_id,
                    "generation": generation,
                    "horizon_months": horizon,
                    "change_percent": 100 * (points[-1][1] / points[-1 - horizon][1] - 1),
                    "latest_date": points[-1][0],
                    "observations": len(points),
                }
            )
    selected: dict[tuple[str, int], dict[str, Any]] = {}
    for item in output:
        key = (str(item["generation"]), int(item["horizon_months"]))
        current = selected.get(key)
        preference = (
            str(item["series_id"]).startswith(f"{item['generation']} ("),
            int(item["observations"]),
        )
        current_preference = (
            str(current["series_id"]).startswith(f"{current['generation']} ("),
            int(current["observations"]),
        ) if current else (False, 0)
        if current is None or preference > current_preference:
            selected[key] = item
    return [selected[key] for key in sorted(selected)]


def build_business_analytics(
    connection: duckdb.DuckDBPyConnection,
    index_result: IndexResult,
    weights: dict[str, float],
) -> dict[str, Any]:
    latest_event = connection.execute("SELECT max(published_at) FROM news_events").fetchone()[0]
    event_counts = {"latest_30_days": 0, "prior_30_days": 0, "policy_events": 0}
    if latest_event:
        event_counts = {
            "latest_30_days": connection.execute(
                "SELECT count(*) FROM news_events WHERE published_at > ? - INTERVAL 30 DAY", [latest_event]
            ).fetchone()[0],
            "prior_30_days": connection.execute(
                """SELECT count(*) FROM news_events
                WHERE published_at > ? - INTERVAL 60 DAY AND published_at <= ? - INTERVAL 30 DAY""",
                [latest_event, latest_event],
            ).fetchone()[0],
            "policy_events": connection.execute(
                "SELECT count(*) FROM news_events WHERE query_category = 'semiconductor_policy'"
            ).fetchone()[0],
        }
    components = []
    represented = sum(weights.get(item.key, 0) for item in index_result.components if item.score is not None) or 1
    for item in index_result.components:
        components.append(
            {
                **item.as_dict(),
                "label": COMPONENT_LABELS.get(item.key, item.key),
                "effective_weight": weights.get(item.key, 0) / represented if item.score is not None else 0,
                "weighted_contribution": (
                    float(item.score) * weights.get(item.key, 0) / represented if item.score is not None else None
                ),
            }
        )
    evidence_readiness = build_evidence_readiness(connection)
    return {
        "components": components,
        "pressure_history": _pressure_history(connection),
        "momentum_matrix": _momentum_matrix(connection),
        "macro_series": _macro_series(connection),
        "model_diagnostics": _model_diagnostics(connection),
        "event_pressure": event_counts,
        "model_readiness": {
            "ddr5_monthly_points": evidence_readiness["ddr5_months"],
            "baseline_models_ready": evidence_readiness["short_term_ready"],
            "advanced_ml_ready": evidence_readiness["long_range_statistical_ready"],
            "points_until_advanced_ml": max(
                0,
                evidence_readiness["thresholds"]["ddr5_months"]
                - evidence_readiness["ddr5_months"],
            ),
            "explanation": evidence_readiness["explanation"],
        },
        "evidence_readiness": evidence_readiness,
    }
