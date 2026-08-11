from __future__ import annotations

import warnings
from dataclasses import dataclass
from datetime import date, datetime, timezone

import numpy as np
from statsmodels.tsa.ar_model import AutoReg
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.forecasting.theta import ThetaModel
from statsmodels.tsa.holtwinters import ExponentialSmoothing, Holt

from memorypulse.models import ForecastObservation

MINIMUM_HISTORY = 12
MODEL_VERSION = "2.1.0"


@dataclass(slots=True)
class BacktestResult:
    name: str
    mae: float
    mape: float | None
    smape: float | None
    mase: float | None
    direction_accuracy: float | None
    residuals: list[float]
    validation_points: int
    stability: float


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


MODEL_MINIMUMS = {
    "naive_last_value": 2,
    "drift": 3,
    "rolling_mean_3": 3,
    "seasonal_naive_12": 13,
    "holt_damped_trend": 8,
    "ets_additive_damped": 10,
    "theta": 12,
    "autoregressive": 14,
    "arima_111": 16,
    "robust_ensemble": 14,
}
MODELS = {name: name for name in MODEL_MINIMUMS}


def _forecast_ets(values: np.ndarray, horizon: int) -> float:
    fitted = ExponentialSmoothing(
        values,
        trend="add",
        damped_trend=True,
        initialization_method="estimated",
    ).fit(optimized=True, use_brute=False)
    return float(np.asarray(fitted.forecast(horizon), dtype=float)[-1])


def _forecast_theta(values: np.ndarray, horizon: int) -> float:
    fitted = ThetaModel(values, period=1, deseasonalize=False).fit()
    return float(np.asarray(fitted.forecast(horizon), dtype=float)[-1])


def _forecast_autoregressive(values: np.ndarray, horizon: int) -> float:
    lags = max(1, min(4, len(values) // 5))
    fitted = AutoReg(values, lags=lags, trend="ct", old_names=False).fit()
    return float(np.asarray(fitted.predict(start=len(values), end=len(values) + horizon - 1), dtype=float)[-1])


def _forecast_arima(values: np.ndarray, horizon: int) -> float:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        fitted = ARIMA(
            values,
            order=(1, 1, 1),
            enforce_stationarity=False,
            enforce_invertibility=False,
        ).fit()
    return float(np.asarray(fitted.forecast(horizon), dtype=float)[-1])


def _forecast_ensemble(values: np.ndarray, horizon: int) -> float:
    candidates = []
    for name in (
        "naive_last_value",
        "drift",
        "rolling_mean_3",
        "holt_damped_trend",
        "theta",
        "autoregressive",
    ):
        if len(values) < MODEL_MINIMUMS[name]:
            continue
        try:
            candidates.append(forecast_model(values, name, horizon))
        except (ValueError, RuntimeError, np.linalg.LinAlgError):
            continue
    if not candidates:
        return _naive(values)
    return float(np.median(np.asarray(candidates, dtype=float)))


def forecast_model(values: np.ndarray, model_name: str, horizon: int = 1) -> float:
    if horizon < 1:
        raise ValueError("forecast horizon must be positive")
    if model_name == "naive_last_value":
        return _naive(values)
    if model_name == "drift":
        slope = (float(values[-1]) - float(values[0])) / max(1, len(values) - 1)
        return float(values[-1] + slope * horizon)
    if model_name == "rolling_mean_3":
        extended = values.astype(float).tolist()
        for _ in range(horizon):
            extended.append(float(np.mean(extended[-min(3, len(extended)) :])))
        return extended[-1]
    if model_name == "seasonal_naive_12":
        if len(values) < 12:
            raise ValueError("seasonal naive requires twelve observations")
        return float(values[-12 + ((horizon - 1) % 12)])
    if model_name == "holt_damped_trend":
        fitted = Holt(values, damped_trend=True, initialization_method="estimated").fit(optimized=True)
        return float(fitted.forecast(horizon)[-1])
    if model_name == "ets_additive_damped":
        return _forecast_ets(values, horizon)
    if model_name == "theta":
        return _forecast_theta(values, horizon)
    if model_name == "autoregressive":
        return _forecast_autoregressive(values, horizon)
    if model_name == "arima_111":
        return _forecast_arima(values, horizon)
    if model_name == "robust_ensemble":
        return _forecast_ensemble(values, horizon)
    raise KeyError(f"unknown model: {model_name}")


def rolling_origin_backtest(values: list[float], model_name: str, horizon: int = 1) -> BacktestResult:
    if horizon < 1:
        raise ValueError("backtest horizon must be positive")
    data = np.asarray(values, dtype=float)
    start = max(6, len(data) // 2, MODEL_MINIMUMS[model_name])
    if len(data) < start + horizon:
        return BacktestResult(model_name, float("inf"), None, None, None, None, [], 0, 0.0)
    residuals = []
    percentage_errors = []
    symmetric_errors = []
    directions = []
    fallbacks = 0
    for index in range(start, len(data) - horizon + 1):
        try:
            prediction = forecast_model(data[:index], model_name, horizon)
        except (ValueError, RuntimeError, np.linalg.LinAlgError):
            prediction = _naive(data[:index])
            fallbacks += 1
        actual = float(data[index + horizon - 1])
        error = actual - prediction
        residuals.append(error)
        if actual != 0:
            percentage_errors.append(abs(error / actual) * 100)
        denominator = abs(actual) + abs(prediction)
        if denominator:
            symmetric_errors.append(200 * abs(error) / denominator)
        actual_direction = np.sign(actual - float(data[index - 1]))
        predicted_direction = np.sign(prediction - float(data[index - 1]))
        directions.append(float(actual_direction == predicted_direction))
    mae = float(np.mean(np.abs(residuals))) if residuals else float("inf")
    mape = float(np.mean(percentage_errors)) if percentage_errors else None
    smape = float(np.mean(symmetric_errors)) if symmetric_errors else None
    naive_scale = float(np.mean(np.abs(np.diff(data[:start])))) if start > 1 else 0.0
    mase = mae / naive_scale if naive_scale > 0 and np.isfinite(mae) else None
    direction_accuracy = float(np.mean(directions) * 100) if directions else None
    validation_points = len(residuals)
    stability = 1 - fallbacks / validation_points if validation_points else 0.0
    return BacktestResult(
        model_name,
        mae,
        mape,
        smape,
        mase,
        direction_accuracy,
        residuals,
        validation_points,
        stability,
    )


def forecast_series(
    series_id: str,
    dates: list[date],
    values: list[float],
    target_date: date,
    frequency: str = "monthly",
    created_at: datetime | None = None,
    horizon: int = 1,
) -> ForecastObservation | None:
    if len(values) < MINIMUM_HISTORY or len(values) != len(dates):
        return None
    results = [rolling_origin_backtest(values, name, horizon) for name in MODELS]
    eligible = [result for result in results if np.isfinite(result.mae) and result.stability >= 0.75]
    if not eligible:
        return None
    naive = next(result for result in results if result.name == "naive_last_value")
    best = min(eligible, key=lambda result: (result.mae, result.name != "naive_last_value"))
    if best.name != "naive_last_value" and best.mae > naive.mae * 0.98:
        best = naive
    data = np.asarray(values, dtype=float)
    try:
        point = forecast_model(data, best.name, horizon)
    except (ValueError, RuntimeError, np.linalg.LinAlgError):
        best = next(result for result in results if result.name == "naive_last_value")
        point = _naive(data)
    absolute_residuals = np.abs(np.asarray(best.residuals, dtype=float))
    conformal_margin = float(np.quantile(absolute_residuals, 0.95)) if len(absolute_residuals) else best.mae
    residual_scale = float(np.std(best.residuals, ddof=1)) if len(best.residuals) > 1 else best.mae
    scale_floor = max(float(np.median(np.abs(np.diff(data)))) * 0.1, abs(point) * 0.005, 1e-6)
    margin = max(best.mae * 1.25, conformal_margin, 1.645 * residual_scale, scale_floor) * float(np.sqrt(horizon))
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
