from memorypulse.analysis.briefing import _confidence_label, _direction


def test_direction_discloses_observed_and_forecast_disagreement() -> None:
    assert _direction(21.7, 0.0) == "Mixed signals"
    assert _direction(-8.0, 4.0) == "Mixed signals"
    assert _direction(3.0, 5.0) == "Upward risk"


def test_confidence_reserves_high_label_for_broad_coverage() -> None:
    assert _confidence_label(0.75, True) == "Medium"
    assert _confidence_label(0.90, True) == "High"
    assert _confidence_label(0.60, False) == "Low"
