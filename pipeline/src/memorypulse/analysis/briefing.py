from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from typing import Any

import duckdb

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


def _confidence_label(value: float, has_forecast: bool) -> str:
    adjusted = value if has_forecast else value * 0.8
    if adjusted >= 0.85:
        return "High"
    if adjusted >= 0.55:
        return "Medium"
    return "Low"


def _direction(recent_change: float | None, forecast_change: float | None) -> str:
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
    forecast_change = (
        100 * (float(forecast["point_forecast"]) / latest_price - 1)
        if forecast and latest_price
        else None
    )
    recent_change = key_changes.get("ddr5_recent_change")
    direction = _direction(recent_change, forecast_change)
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
    ]
    conclusion = (
        f"{regime} conditions with {direction.lower()} and {confidence.lower()} confidence. "
        f"The analytical procurement posture is to {procurement.lower()}, while the inventory posture is to "
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
        },
        "method": "Deterministic rules over validated index components and the best rolling-backtest forecast.",
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
        selected = min(results, key=lambda result: (result.mae, result.name != "naive_last_value")).name
        output.append(
            {
                "series_id": series_id,
                "observations": len(values),
                "selected_model": selected,
                "advanced_ml_ready": len(values) >= 60,
                "candidates": [
                    {"model": result.name, "mae": result.mae, "mape": result.mape, "selected": result.name == selected}
                    for result in sorted(results, key=lambda item: item.mae)
                ],
            }
        )
    return output


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
    readiness_points = connection.execute(
        "SELECT count(DISTINCT observation_date) FROM memory_prices WHERE memory_generation = 'DDR5'"
    ).fetchone()[0]
    return {
        "components": components,
        "pressure_history": _pressure_history(connection),
        "momentum_matrix": _momentum_matrix(connection),
        "macro_series": _macro_series(connection),
        "model_diagnostics": _model_diagnostics(connection),
        "event_pressure": event_counts,
        "model_readiness": {
            "ddr5_monthly_points": readiness_points,
            "baseline_models_ready": readiness_points >= 12,
            "advanced_ml_ready": readiness_points >= 60,
            "points_until_advanced_ml": max(0, 60 - readiness_points),
            "explanation": "Transparent baselines are used now; boosted multivariate models remain gated until at least 60 comparable monthly observations exist.",
        },
    }
