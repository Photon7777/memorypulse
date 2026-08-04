from __future__ import annotations

from pathlib import Path

from memorypulse.config import source_config
from memorypulse.sources import (
    BestBuyMemoryProductsSource,
    DramExchangeHomepageSource,
    FredSemiconductorSource,
    GdeltMemoryNewsSource,
    StanfordMemoryPricesSource,
)

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = Path(__file__).parent / "fixtures"


def test_stanford_csv_parsing_preserves_attribution_and_estimates() -> None:
    source = StanfordMemoryPricesSource(source_config(ROOT)["stanford_memory_prices"], ROOT)
    records, health = source.run(FIXTURES / "stanford_memory_prices.csv")
    assert health.status == "success"
    assert len(records) == 15
    assert records[0].source_label.endswith("fixture_source")
    hbm = next(record for record in records if record.memory_generation == "HBM")
    assert hbm.is_estimate is True
    assert hbm.capacity_unit == "Gb"


def test_public_homepage_parser_is_bounded_and_keeps_gigabits() -> None:
    config = {**source_config(ROOT)["dramexchange_homepage"], "enabled": True}
    source = DramExchangeHomepageSource(config, ROOT)
    records, health = source.run(FIXTURES / "dramexchange_homepage.html")
    assert health.status == "success"
    assert len(records) == 2
    assert records[0].capacity_unit == "Gb"
    assert records[0].price_per_gb is None


def test_fred_csv_parser_normalizes_missing_values() -> None:
    source = FredSemiconductorSource(source_config(ROOT)["fred_semiconductor"], ROOT)
    records, health = source.run(FIXTURES / "fred_semiconductor.csv")
    assert health.status == "success"
    assert records[-1].series_id == "PCU3344133441"
    assert records[-1].value == 104.0


def test_gdelt_metadata_rules_do_not_store_article_bodies() -> None:
    source = GdeltMemoryNewsSource(source_config(ROOT)["gdelt_memory_news"], ROOT)
    records, health = source.run(FIXTURES / "gdelt_news.json")
    assert health.status == "success"
    assert records[0].short_excerpt.startswith("TEST FIXTURE")
    assert "HBM investment" in records[0].event_tags
    assert records[0].source_domain == "example.test"


def test_bestbuy_is_optional_without_api_key(monkeypatch) -> None:
    monkeypatch.delenv("BESTBUY_API_KEY", raising=False)
    source = BestBuyMemoryProductsSource(source_config(ROOT)["bestbuy_memory_products"], ROOT)
    records, health = source.run()
    assert records == []
    assert health.status == "disabled"


def test_bestbuy_fixture_keeps_uncertain_products_but_exposes_confidence() -> None:
    source = BestBuyMemoryProductsSource(source_config(ROOT)["bestbuy_memory_products"], ROOT)
    records, _ = source.run(FIXTURES / "bestbuy_products.json")
    assert len(records) == 2
    assert records[0].price_per_gb is not None
    assert records[1].parsing_confidence == 0
