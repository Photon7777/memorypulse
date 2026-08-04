from __future__ import annotations

from datetime import date

import pytest
from memorypulse.indicators.pressure import (
    ComponentResult,
    calculate_index,
    robust_percentile_score,
    status_label,
)

WEIGHTS = {
    "spot_momentum": 0.30,
    "retail_momentum": 0.25,
    "volatility": 0.15,
    "news_pressure": 0.15,
    "macro_pressure": 0.15,
}


def component(key: str, score: float | None) -> ComponentResult:
    return ComponentResult(key, score, {"fixture": 1}, "test transformation", 1 if score is not None else 0)


def test_each_component_contributes_its_configured_weight() -> None:
    components = [
        component("spot_momentum", 100),
        component("retail_momentum", 0),
        component("volatility", 100),
        component("news_pressure", 0),
        component("macro_pressure", 100),
    ]
    result = calculate_index(components, WEIGHTS, "test", date(2025, 1, 1))
    assert result.observation.total_score == 60
    assert result.observation.confidence_score == 1
    assert result.observation.status_label == "Elevated Pressure"


def test_missing_components_are_reweighted_and_reduce_confidence() -> None:
    components = [component(key, 80 if key == "spot_momentum" else None) for key in WEIGHTS]
    result = calculate_index(components, WEIGHTS, "test", date(2025, 1, 1))
    assert result.observation.total_score == 80
    assert result.observation.confidence_score == pytest.approx(0.3)
    assert "reduced confidence" in result.insights[0]


def test_robust_normalization_and_status_boundaries() -> None:
    assert robust_percentile_score(1000, [1, 2, 3, 4, 5]) == 100
    assert robust_percentile_score(None, [1, 2, 3]) is None
    assert [status_label(value) for value in (0, 25, 50, 75)] == [
        "Normal",
        "Moderate Pressure",
        "Elevated Pressure",
        "Severe Pressure",
    ]
