from __future__ import annotations

from datetime import date, datetime, timezone

from memorypulse.forecasting.models import MINIMUM_HISTORY, forecast_series, rolling_origin_backtest
from memorypulse.forecasting.structural import build_structural_forecasts


def test_forecast_is_withheld_below_minimum_history() -> None:
    dates = [date(2024, month, 1) for month in range(1, 6)]
    assert forecast_series("fixture", dates, [1, 2, 3, 4, 5], date(2024, 6, 1)) is None


def test_rolling_origin_backtest_and_forecast_metadata() -> None:
    dates = [date(2024 + index // 12, index % 12 + 1, 1) for index in range(MINIMUM_HISTORY + 2)]
    values = [10 + index * 0.25 for index in range(len(dates))]
    backtest = rolling_origin_backtest(values, "naive_last_value")
    assert backtest.mae > 0
    assert backtest.smape is not None
    assert backtest.validation_points > 0
    assert backtest.stability == 1
    forecast = forecast_series("fixture", dates, values, date(2025, 3, 1))
    assert forecast is not None
    assert forecast.observations_used == len(values)
    assert forecast.lower_bound <= forecast.point_forecast <= forecast.upper_bound
    assert forecast.backtest_mae >= 0
    assert forecast.model_version == "2.1.0"


def test_complex_candidates_are_scored_without_hiding_naive_baseline() -> None:
    values = [10 + index * 0.3 + (0.2 if index % 4 == 0 else 0) for index in range(30)]
    naive = rolling_origin_backtest(values, "naive_last_value")
    ensemble = rolling_origin_backtest(values, "robust_ensemble")
    assert naive.validation_points > 0
    assert ensemble.validation_points > 0
    assert ensemble.smape is not None
    assert 0 <= ensemble.stability <= 1


def test_longer_horizon_expands_uncertainty() -> None:
    dates = [date(2024 + index // 12, index % 12 + 1, 1) for index in range(MINIMUM_HISTORY + 8)]
    values = [8 + index * 0.2 + (0.15 if index % 3 == 0 else -0.05) for index in range(len(dates))]
    one = forecast_series("fixture", dates, values, date(2025, 9, 1), horizon=1)
    six = forecast_series("fixture", dates, values, date(2026, 2, 1), horizon=6)
    assert one is not None and six is not None
    assert six.upper_bound - six.lower_bound > one.upper_bound - one.lower_bound


def test_structural_forecast_publishes_three_scenarios_and_rising_base() -> None:
    dates = [date(2024 + index // 12, index % 12 + 1, 1) for index in range(24)]
    values = [2.0 + index * 0.18 + (0.12 if index % 4 == 0 else 0) for index in range(24)]
    forecasts = build_structural_forecasts(
        "DDR5 (fixture)",
        dates,
        values,
        datetime(2026, 1, 1, tzinfo=timezone.utc),
        {12: date(2026, 12, 1), 18: date(2027, 6, 1), 24: date(2027, 12, 1)},
        4.0,
        "upward",
        ["trendforce_memory_outlook"],
    )
    assert len(forecasts) == 9
    assert {forecast.scenario for forecast in forecasts} == {"easing", "base", "tight_supply"}
    assert all(forecast.lower_bound <= forecast.point_forecast <= forecast.upper_bound for forecast in forecasts)
    assert all(forecast.direction == "upward" for forecast in forecasts if forecast.scenario == "base")
