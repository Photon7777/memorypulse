from __future__ import annotations

from datetime import date, datetime, timezone

from memorypulse.models import IndustryOutlookObservation, PriceObservation, stable_id
from memorypulse.transformations.normalize import (
    deduplicate_prices,
    flag_outliers,
    parse_capacity,
    price_per_gb,
)
from memorypulse.transformations.storage import (
    append_csv_records,
    atomic_write_text,
    ensure_history_files,
    read_csv_rows,
)


def observation(identity: str = "test_1") -> PriceObservation:
    return PriceObservation(
        observation_id=identity,
        observation_date=date(2025, 1, 1),
        collected_at=datetime(2025, 1, 2, tzinfo=timezone.utc),
        source_id="fixture",
        market_type="test_fixture",
        memory_generation="DDR4",
        product_type="fixture product",
        capacity_value=16,
        capacity_unit="GB",
        speed_mts=3200,
        price_value=32,
        currency="USD",
        price_basis="per_module",
        price_per_gb=2,
        daily_high=None,
        daily_low=None,
        session_average=None,
        source_url="https://example.test",
        source_label="fixture",
        source_reliability="fixture",
        raw_description="TEST FIXTURE 16GB DDR4",
        is_estimate=False,
    )


def test_gb_and_gigabit_units_are_not_conflated() -> None:
    assert parse_capacity("16GB DDR5 module") == (16.0, "GB")
    assert parse_capacity("16Gb DDR5 chip") == (16.0, "Gb")
    assert price_per_gb(40, 16, "GB") == 2.5
    assert price_per_gb(40, 16, "Gb") is None


def test_stable_observation_ids_and_deduplication() -> None:
    assert stable_id("price", "A", date(2025, 1, 1)) == stable_id("price", "a", date(2025, 1, 1))
    item = observation()
    assert deduplicate_prices([item, item]) == [item]


def test_atomic_append_is_idempotent(tmp_path) -> None:
    history = tmp_path / "history"
    ensure_history_files(history)
    assert append_csv_records(history / "spot_prices.csv", [observation()], "observation_id") == (1, 0)
    assert append_csv_records(history / "spot_prices.csv", [observation()], "observation_id") == (0, 1)
    assert len(read_csv_rows(history / "spot_prices.csv")) == 1
    assert not list(history.glob(".*.tmp"))


def test_atomic_write_preserves_previous_file_on_replace_failure(tmp_path, monkeypatch) -> None:
    path = tmp_path / "history.csv"
    path.write_text("previous\n")

    def fail_replace(_source, _target) -> None:
        raise OSError("simulated replace failure")

    monkeypatch.setattr("memorypulse.transformations.storage.os.replace", fail_replace)
    import pytest

    with pytest.raises(OSError, match="simulated"):
        atomic_write_text(path, "replacement\n")
    assert path.read_text() == "previous\n"


def test_sudden_values_are_flagged_not_deleted() -> None:
    values = [10, 10.1, 9.9, 10.2, 10.0, 50]
    flags = flag_outliers(values)
    assert len(flags) == len(values)
    assert flags[-1] is True


def test_industry_outlook_preserves_qualitative_direction_without_invented_range() -> None:
    outlook = IndustryOutlookObservation(
        outlook_id="outlook_fixture",
        published_at=date(2026, 7, 30),
        collected_at=datetime(2026, 8, 10, tzinfo=timezone.utc),
        horizon_end=date(2027, 12, 31),
        segment="DRAM",
        metric="contract_price_direction",
        direction="upward",
        central_estimate=None,
        lower_estimate=None,
        upper_estimate=None,
        unit="qualitative direction",
        summary="Supply remains constrained.",
        source_id="fixture",
        source_url="https://example.test/outlook",
        source_label="Fixture",
        notes="No numeric estimate supplied.",
    )
    outlook.validate()
    assert outlook.central_estimate is None
