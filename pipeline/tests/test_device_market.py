from __future__ import annotations

from pathlib import Path

from memorypulse.analysis.device_market import build_device_market
from memorypulse.config import device_watchlist, source_allowed_in_free_mode, source_config
from memorypulse.database import create_database

ROOT = Path(__file__).resolve().parents[2]


def test_free_only_policy_excludes_paid_and_restricted_sources() -> None:
    sources = source_config(ROOT)
    assert source_allowed_in_free_mode(sources["stanford_memory_prices"]) is True
    assert source_allowed_in_free_mode(sources["sec_memory_supplier_fundamentals"]) is True
    assert source_allowed_in_free_mode(sources["keepa_ddr5_panel"]) is False
    assert source_allowed_in_free_mode(sources["bestbuy_memory_products"]) is False


def test_watchlist_is_broad_and_free() -> None:
    watchlist = device_watchlist(ROOT)
    families = [
        family
        for category in watchlist["categories"].values()
        for names in category["families"].values()
        for family in names
    ]
    assert watchlist["free_only"] is True
    assert len(watchlist["categories"]) >= 6
    assert len(families) >= 40
    assert watchlist["panel_targets"]["minimum_comparable_transitions_for_modeling"] == 100


def test_reviewed_device_events_capture_price_and_spec_compression(tmp_path) -> None:
    connection = create_database(ROOT / "data/history", tmp_path / "test.duckdb")
    market = build_device_market(connection)
    connection.close()

    events = {item["product_family"]: item for item in market["events"]}
    assert events["Google Pixel Pro entry tier"]["response_type"] == "price_and_spec_compression"
    assert events["Surface Laptop 13-inch entry tier"]["ram_change_percent"] == -50
    assert market["metrics"]["primary_source_share"] >= 0.8
    assert market["model_readiness"]["ready"] is False
