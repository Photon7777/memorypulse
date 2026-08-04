from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, timezone

import numpy as np
from statsmodels.tsa.holtwinters import Holt

from memorypulse.models import ForecastObservation

MINIMUM_HISTORY = 12
MODEL_VERSION = "1.0.0"


@dataclass(slots=True)
class BacktestResult:
    name: str
    mae: float
    mape: float | None
    residuals: list[float]


def _naive(values: np.ndarray) -> float:
    return float(values[-1])


def _drift(values: np.ndarray) -> float:
    if len(values) < 2:
        return _naive(values)
    return float(values[-1] + (values[-1] - values[0]) / (len(values) - 1))


def _rolling(values: np.ndarray) -> float:
    return float(np.mean(values[-min(3, len(values)) :]))


def _holt(values: np.ndarray) -> float:
    fitted = Holt(values, damped_trend=True, initialization_method="estimated").fit(optimized=True)
    return float(fitted.forecast(1)[0])


MODELS: dict[str, Callable[[np.ndarray], float]] = {
    "naive_last_value": _naive,
    "drift": _drift,
    "rolling_mean_3": _rolling,
    "holt_damped_trend": _holt,
}


def rolling_origin_backtest(values: list[float], model_name: str) -> BacktestResult:
    data = np.asarray(values, dtype=float)
    start = max(6, len(data) // 2)
    residuals = []
    percentage_errors = []
    for index in range(start, len(data)):
        try:
            prediction = MODELS[model_name](data[:index])
        except (ValueError, RuntimeError, np.linalg.LinAlgError):
            prediction = _naive(data[:index])
        actual = float(data[index])
        error = actual - prediction
        residuals.append(error)
        if actual != 0:
            percentage_errors.append(abs(error / actual) * 100)
    mae = float(np.mean(np.abs(residuals))) if residuals else float("inf")
    mape = float(np.mean(percentage_errors)) if percentage_errors else None
    return BacktestResult(model_name, mae, mape, residuals)


def forecast_series(
    series_id: str,
    dates: list[date],
    values: list[float],
    target_date: date,
    frequency: str = "monthly",
    created_at: datetime | None = None,
) -> ForecastObservation | None:
    if len(values) < MINIMUM_HISTORY or len(values) != len(dates):
        return None
    results = [rolling_origin_backtest(values, name) for name in MODELS]
    best = min(results, key=lambda result: (result.mae, result.name != "naive_last_value"))
    data = np.asarray(values, dtype=float)
    try:
        point = MODELS[best.name](data)
    except (ValueError, RuntimeError, np.linalg.LinAlgError):
        best = next(result for result in results if result.name == "naive_last_value")
        point = _naive(data)
    residual_scale = float(np.std(best.residuals, ddof=1)) if len(best.residuals) > 1 else best.mae
    margin = max(0.0, 1.96 * residual_scale)
    return ForecastObservation(
        forecast_created_at=created_at or datetime.now(timezone.utc).replace(microsecond=0),
        target_date=target_date,
        series_id=series_id,
        model_name=best.name,
        model_version=MODEL_VERSION,
        point_forecast=round(point, 6),
        lower_bound=round(max(0.0, point - margin), 6),
        upper_bound=round(point + margin, 6),
        training_start=min(dates),
        training_end=max(dates),
        backtest_mae=round(best.mae, 6),
        backtest_mape=round(best.mape, 4) if best.mape is not None else None,
        observations_used=len(values),
        data_frequency=frequency,
    )
