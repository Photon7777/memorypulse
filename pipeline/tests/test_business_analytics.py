from memorypulse.analysis.briefing import _confidence_label, _direction
from memorypulse.analysis.evidence import build_evidence_readiness
from memorypulse.database import create_database
from memorypulse.transformations.storage import ensure_history_files


def test_direction_discloses_observed_and_forecast_disagreement() -> None:
    assert _direction(21.7, 0.0) == "Mixed signals"
    assert _direction(-8.0, 4.0) == "Mixed signals"
    assert _direction(3.0, 5.0) == "Upward risk"


def test_confidence_reserves_high_label_for_broad_coverage() -> None:
    assert _confidence_label(0.75, True) == "Medium"
    assert _confidence_label(0.90, True) == "High"
    assert _confidence_label(0.60, False) == "Low"


def test_evidence_readiness_withholds_long_range_statistical_status_without_panel(tmp_path) -> None:
    history = tmp_path / "history"
    ensure_history_files(history)
    connection = create_database(history, tmp_path / "evidence.duckdb")
    readiness = build_evidence_readiness(connection)
    connection.close()

    assert readiness["score"] == 0
    assert readiness["status"] == "scenario_only"
    assert readiness["long_range_statistical_ready"] is False
    assert len(readiness["blockers"]) == 4
