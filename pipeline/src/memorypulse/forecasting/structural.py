from __future__ import annotations

from datetime import date, datetime
from typing import Any

import numpy as np

from memorypulse.models import StructuralForecastObservation

MODEL_NAME = "market_driver_ensemble"
MODEL_VERSION = "1.1.0"
STRUCTURAL_HORIZONS = (12, 18, 24)


def _annualized_log_change(values: np.ndarray, months: int) -> float | None:
    if len(values) <= months or values[-1] <= 0 or values[-1 - months] <= 0:
        return None
    return float(np.log(values[-1] / values[-1 - months]) * 12 / months)


def _direction(value: float) -> str:
    if value > 0.01:
        return "upward"
    if value < -0.01:
        return "easing"
    return "flat"


def build_structural_forecasts(
    series_id: str,
    dates: list[date],
    values: list[float],
    created_at: datetime,
    target_dates: dict[int, date],
    macro_drivers: dict[str, float | None],
    expert_direction: str | None,
    expert_source_ids: list[str],
    evidence_readiness: dict[str, Any],
) -> list[StructuralForecastObservation]:
    """Build transparent long-range scenarios without relabeling them as local time-series forecasts.

    The central annual rate dynamically reweights robust observed momentum, available official
    price/capacity signals, and a disclosed directional prior from attributed research. Inputs
    are clipped and the second year is damped because the target has limited history.
    """
    if len(values) < 18 or len(values) != len(dates) or any(value <= 0 for value in values):
        return []

    data = np.asarray(values, dtype=float)
    momentum_candidates = [
        change for months in (3, 6, 12)
        if (change := _annualized_log_change(data, months)) is not None
    ]
    if not momentum_candidates:
        return []
    observed_rate = float(np.median(np.clip(momentum_candidates, -0.35, 0.60)))
    expert_prior = 0.12 if expert_direction == "upward" else -0.08 if expert_direction == "easing" else None
    weighted_rates: list[tuple[float, float]] = [(0.40, observed_rate)]
    producer_price_change = macro_drivers.get("producer_price_change")
    import_price_change = macro_drivers.get("import_price_change")
    capacity_utilization_change = macro_drivers.get("capacity_utilization_change")
    if producer_price_change is not None:
        weighted_rates.append((0.15, float(np.clip(producer_price_change / 100, -0.20, 0.20))))
    if import_price_change is not None:
        weighted_rates.append((0.15, float(np.clip(import_price_change / 100, -0.20, 0.30))))
    if capacity_utilization_change is not None:
        weighted_rates.append((0.10, float(np.clip(capacity_utilization_change / 100, -0.10, 0.10))))
    if expert_prior is not None:
        weighted_rates.append((0.20, expert_prior))
    represented_weight = sum(weight for weight, _ in weighted_rates)
    base_rate = float(np.clip(
        sum(weight * rate for weight, rate in weighted_rates) / represented_weight,
        -0.20,
        0.45,
    ))

    log_returns = np.diff(np.log(data[-min(len(data), 18) :]))
    annual_volatility = float(np.std(log_returns, ddof=1) * np.sqrt(12)) if len(log_returns) > 1 else 0.20
    downside_rate = float(np.clip(base_rate - max(0.18, annual_volatility * 0.45), -0.30, 0.25))
    upside_rate = float(np.clip(base_rate + max(0.22, annual_volatility * 0.55), 0.12, 0.70))
    if evidence_readiness.get("long_range_statistical_ready") and evidence_readiness.get("score", 0) >= 80:
        confidence = "high"
    elif (
        evidence_readiness.get("ddr5_months", 0) >= 36
        and evidence_readiness.get("direct_sources", 0) >= 2
        and evidence_readiness.get("retail_products", 0) >= 10
        and evidence_readiness.get("driver_family_count", 0) >= 3
    ):
        confidence = "moderate"
    else:
        confidence = "low"
    baseline = float(data[-1])
    source_ids = ";".join(sorted({"fred_semiconductor", *expert_source_ids}))
    driver_parts = [f"observed annualized DDR5 momentum {100 * observed_rate:.1f}%"]
    if producer_price_change is not None:
        driver_parts.append(f"semiconductor PPI change {producer_price_change:.1f}%")
    if import_price_change is not None:
        driver_parts.append(f"semiconductor import-price change {import_price_change:.1f}%")
    if capacity_utilization_change is not None:
        driver_parts.append(f"capacity-utilization change {capacity_utilization_change:.1f}%")
    driver_parts.append(f"expert direction {expert_direction or 'mixed'}")
    driver_summary = "; ".join(driver_parts) + "."
    basis = (
        "Dynamically reweighted scenario ensemble: 40% clipped DDR5 momentum, up to 40% "
        "official producer/import-price and capacity signals, and 20% attributed directional "
        f"outlook. Evidence readiness is {evidence_readiness.get('score', 0):.1f}/100 "
        f"({evidence_readiness.get('status', 'scenario_only')}); growth is damped beyond year one. "
        "Scenarios are market-informed estimates, not guaranteed retail prices."
    )

    output: list[StructuralForecastObservation] = []
    for horizon in STRUCTURAL_HORIZONS:
        years = horizon / 12
        effective_years = years if years <= 1 else 1 + (years - 1) * 0.65
        scenario_values = {
            "easing": baseline * float(np.exp(downside_rate * effective_years)),
            "base": baseline * float(np.exp(base_rate * effective_years)),
            "tight_supply": baseline * float(np.exp(upside_rate * effective_years)),
        }
        lower = min(scenario_values.values())
        upper = max(scenario_values.values())
        for scenario, point in scenario_values.items():
            output.append(
                StructuralForecastObservation(
                    forecast_created_at=created_at,
                    target_date=target_dates[horizon],
                    series_id=series_id,
                    scenario=scenario,
                    model_name=MODEL_NAME,
                    model_version=MODEL_VERSION,
                    point_forecast=round(point, 6),
                    lower_bound=round(lower, 6),
                    upper_bound=round(upper, 6),
                    baseline_value=round(baseline, 6),
                    change_from_baseline_percent=round(100 * (point / baseline - 1), 2),
                    direction=_direction(point / baseline - 1),
                    confidence=confidence,
                    driver_summary=driver_summary,
                    basis=basis,
                    source_ids=source_ids,
                )
            )
    return output
