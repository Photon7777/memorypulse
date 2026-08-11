from __future__ import annotations

from pathlib import Path

import pytest
import requests
from memorypulse.config import source_config
from memorypulse.sources import (
    BestBuyMemoryProductsSource,
    BlsSemiconductorEmploymentSource,
    CensusMemoryExportsSource,
    CensusMemoryImportsSource,
    DramExchangeHomepageSource,
    FederalRegisterSemiconductorSource,
    FredSemiconductorSource,
    GdeltMemoryNewsSource,
    KeepaDdr5PanelSource,
    SecMemorySupplierSource,
    StanfordMemoryPricesSource,
    WorldBankHighTechExportsSource,
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


def test_bls_employment_parser_excludes_annual_average() -> None:
    source = BlsSemiconductorEmploymentSource(source_config(ROOT)["bls_semiconductor_employment"], ROOT)
    records, health = source.run(FIXTURES / "bls_semiconductor_employment.json")
    assert health.status == "success"
    assert len(records) == 2
    assert records[-1].series_id == "CES3133441301"
    assert records[-1].unit == "thousand employees"


def test_world_bank_parser_keeps_only_observed_values() -> None:
    source = WorldBankHighTechExportsSource(source_config(ROOT)["world_bank_high_tech_exports"], ROOT)
    records, health = source.run(FIXTURES / "world_bank_high_tech_exports.json")
    assert health.status == "success"
    assert len(records) == 2
    assert records[-1].series_id == "TX.VAL.TECH.CD"


def test_federal_register_parser_stores_policy_metadata_only() -> None:
    source = FederalRegisterSemiconductorSource(source_config(ROOT)["federal_register_semiconductor"], ROOT)
    records, health = source.run(FIXTURES / "federal_register_semiconductor.json")
    assert health.status == "success"
    assert len(records) == 1
    assert records[0].source_domain == "federalregister.gov"
    assert "export controls" in records[0].event_tags
    assert records[0].manually_important is True


def test_gdelt_metadata_rules_do_not_store_article_bodies() -> None:
    source = GdeltMemoryNewsSource(source_config(ROOT)["gdelt_memory_news"], ROOT)
    records, health = source.run(FIXTURES / "gdelt_news.json")
    assert health.status == "success"
    assert records[0].short_excerpt.startswith("TEST FIXTURE")
    assert "HBM investment" in records[0].event_tags
    assert records[0].source_domain == "example.test"


def test_gdelt_rate_limit_is_not_retried_or_leaked(monkeypatch, tmp_path) -> None:
    source = GdeltMemoryNewsSource(source_config(ROOT)["gdelt_memory_news"], tmp_path)
    calls = 0

    def rate_limited(*args, **kwargs):
        nonlocal calls
        calls += 1
        response = requests.Response()
        response.status_code = 429
        response.url = "https://api.gdeltproject.org/api/v2/doc/doc?query=sensitive-query"
        response._content = b"rate limited"
        return response

    monkeypatch.setattr(source.session, "get", rate_limited)
    records, health = source.run()

    assert records == []
    assert calls == 1
    assert health.status == "degraded"
    assert health.response_status == 429
    assert "HTTP 429" in health.reason
    assert "query=" not in health.reason


def test_bestbuy_public_archive_is_disabled_by_source_terms(monkeypatch) -> None:
    monkeypatch.delenv("BESTBUY_API_KEY", raising=False)
    source = BestBuyMemoryProductsSource(source_config(ROOT)["bestbuy_memory_products"], ROOT)
    records, health = source.run()
    assert records == []
    assert health.status == "disabled"
    assert "72 hours" in health.reason


def test_bestbuy_fixture_keeps_uncertain_products_but_exposes_confidence() -> None:
    source = BestBuyMemoryProductsSource(source_config(ROOT)["bestbuy_memory_products"], ROOT)
    records, _ = source.run(FIXTURES / "bestbuy_products.json")
    assert len(records) == 2
    assert records[0].price_per_gb is not None
    assert records[1].parsing_confidence == 0


def test_sec_company_facts_adds_supplier_inventory_capex_and_revenue() -> None:
    config = {**source_config(ROOT)["sec_memory_supplier_fundamentals"], "enabled": True}
    source = SecMemorySupplierSource(config, ROOT)
    records, health = source.run(FIXTURES / "sec_companyfacts.json")
    assert health.status == "success"
    assert len(records) == 6
    assert {record.series_id.split("_")[-1] for record in records} == {
        "InventoryNet",
        "PaymentsToAcquirePropertyPlantAndEquipment",
        "RevenueFromContractWithCustomerExcludingAssessedTax",
    }
    assert all(record.source_id == "sec_memory_supplier_fundamentals" for record in records)


def test_census_trade_fixtures_create_monthly_memory_import_and_export_series() -> None:
    imports = CensusMemoryImportsSource(source_config(ROOT)["census_memory_imports"], ROOT)
    exports = CensusMemoryExportsSource(source_config(ROOT)["census_memory_exports"], ROOT)
    import_records, import_health = imports.run(FIXTURES / "census_memory_imports.json")
    export_records, export_health = exports.run(FIXTURES / "census_memory_exports.json")

    assert import_health.status == export_health.status == "success"
    assert len(import_records) == len(export_records) == 2
    assert import_records[-1].series_id == "CENSUS_HS854232_IMPORTS_VALUE"
    assert export_records[-1].series_id == "CENSUS_HS854232_EXPORTS_VALUE"
    assert import_records[-1].value == 1_325_000_000


def test_census_trade_is_optional_without_api_key(monkeypatch) -> None:
    monkeypatch.delenv("CENSUS_API_KEY", raising=False)
    source = CensusMemoryImportsSource(source_config(ROOT)["census_memory_imports"], ROOT)
    records, health = source.run()
    assert records == []
    assert health.status == "disabled"


def test_keepa_fixture_builds_monthly_ddr5_panel_and_preserves_stock_gaps() -> None:
    source = KeepaDdr5PanelSource(source_config(ROOT)["keepa_ddr5_panel"], ROOT)
    records, health = source.run(FIXTURES / "keepa_ddr5_panel.json")

    assert health.status == "success"
    assert {record.sku for record in records} == {"B0FIXTURE1", "B0FIXTURE2"}
    assert all(record.generation == "DDR5" for record in records)
    first_product = [record for record in records if record.sku == "B0FIXTURE1"]
    assert [record.observation_date.month for record in first_product] == [1, 3]
    assert first_product[-1].price_per_gb == pytest.approx(99.99 / 32, abs=1e-6)
    second_product = next(record for record in records if record.sku == "B0FIXTURE2")
    assert second_product.total_capacity_gb == 48


def test_keepa_panel_requires_key_products_and_public_export_acknowledgement(monkeypatch) -> None:
    monkeypatch.delenv("KEEPA_API_KEY", raising=False)
    monkeypatch.delenv("KEEPA_DDR5_ASINS", raising=False)
    monkeypatch.delenv("KEEPA_PUBLIC_EXPORT_ACKNOWLEDGED", raising=False)
    source = KeepaDdr5PanelSource(source_config(ROOT)["keepa_ddr5_panel"], ROOT)
    records, health = source.run()
    assert records == []
    assert health.status == "disabled"
