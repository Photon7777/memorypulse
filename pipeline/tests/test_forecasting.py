from __future__ import annotations

from datetime import date

from memorypulse.forecasting.models import MINIMUM_HISTORY, forecast_series, rolling_origin_backtest


def test_forecast_is_withheld_below_minimum_history() -> None:
    dates = [date(2024, month, 1) for month in range(1, 6)]
    assert forecast_series("fixture", dates, [1, 2, 3, 4, 5], date(2024, 6, 1)) is None


def test_rolling_origin_backtest_and_forecast_metadata() -> None:
    dates = [date(2024 + index // 12, index % 12 + 1, 1) for index in range(MINIMUM_HISTORY + 2)]
    values = [10 + index * 0.25 for index in range(len(dates))]
    backtest = rolling_origin_backtest(values, "naive_last_value")
    assert backtest.mae > 0
    forecast = forecast_series("fixture", dates, values, date(2025, 3, 1))
    assert forecast is not None
    assert forecast.observations_used == len(values)
    assert forecast.lower_bound <= forecast.point_forecast <= forecast.upper_bound
    assert forecast.backtest_mae >= 0


def test_longer_horizon_expands_uncertainty() -> None:
    dates = [date(2024 + index // 12, index % 12 + 1, 1) for index in range(MINIMUM_HISTORY + 8)]
    values = [8 + index * 0.2 + (0.15 if index % 3 == 0 else -0.05) for index in range(len(dates))]
    one = forecast_series("fixture", dates, values, date(2025, 9, 1), horizon=1)
    six = forecast_series("fixture", dates, values, date(2026, 2, 1), horizon=6)
    assert one is not None and six is not None
    assert six.upper_bound - six.lower_bound > one.upper_bound - one.lower_bound
