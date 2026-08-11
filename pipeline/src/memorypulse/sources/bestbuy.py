from __future__ import annotations

import json
import os
import re
from datetime import date
from typing import Any
from urllib.parse import urlencode

from memorypulse.models import RetailProductObservation, stable_id
from memorypulse.sources.base import FetchedPayload, HealthResult, SourceAdapter
from memorypulse.transformations.normalize import (
    clean_number,
    parse_capacity,
    parse_speed,
    price_per_gb,
)


class BestBuyMemoryProductsSource(SourceAdapter[RetailProductObservation]):
    source_id = "bestbuy_memory_products"
    source_name = "Best Buy Products API"

    @property
    def is_enabled(self) -> bool:
        return super().is_enabled and bool(os.getenv("BESTBUY_API_KEY"))

    def run(self, fixture_path: Any = None) -> tuple[list[RetailProductObservation], HealthResult]:
        if not fixture_path and not bool(self.config.get("enabled", True)):
            result = HealthResult(
                "disabled",
                str(self.config.get("disabled_reason", "Disabled in source configuration")),
            )
            self._last_health = result
            return [], result
        if not fixture_path and not os.getenv("BESTBUY_API_KEY"):
            result = HealthResult("disabled", "Optional BESTBUY_API_KEY is not configured")
            self._last_health = result
            return [], result
        if fixture_path:
            enabled = self.config.get("enabled", True)
            self.config["enabled"] = True
            try:
                payload = FetchedPayload(fixture_path.read_bytes(), 200, fixture_path.as_uri(), fixture=True)
                rows = self.parse(payload)
                records = self.validate(self.normalize(rows, payload))
                result = HealthResult(
                    "success" if records else "degraded",
                    "" if records else "Fixture returned zero valid rows",
                    len(rows),
                    200,
                    self.freshness_timestamp(records),
                )
                self._last_health = result
                return records, result
            finally:
                self.config["enabled"] = enabled
        return super().run()

    def fetch(self) -> FetchedPayload:
        key = os.environ["BESTBUY_API_KEY"]
        query = "(search=desktop&search=memory)|(search=laptop&search=memory)"
        params = {
            "apiKey": key,
            "format": "json",
            "show": "sku,name,manufacturer,salePrice,regularPrice,url,onlineAvailability",
            "pageSize": 100,
        }
        original = self.config["url"]
        self.config["url"] = f"{original}{query}?{urlencode(params)}"
        try:
            return super().fetch()
        finally:
            self.config["url"] = original

    def parse(self, payload: FetchedPayload) -> list[dict[str, Any]]:
        parsed = json.loads(payload.content.decode("utf-8"))
        products = parsed.get("products", [])
        if not isinstance(products, list):
            raise ValueError("Best Buy response did not include products")
        return [product for product in products if isinstance(product, dict)]

    def normalize(
        self, rows: list[dict[str, Any]], payload: FetchedPayload
    ) -> list[RetailProductObservation]:
        observed = date.today() if not payload.fixture else payload.retrieved_at.date()
        output = []
        for row in rows:
            name = str(row.get("name", ""))
            price = clean_number(row.get("salePrice"))
            sku = str(row.get("sku", ""))
            if not name or price is None or price <= 0 or not sku:
                continue
            capacity, unit = parse_capacity(name)
            generation_match = re.search(r"(?i)\b(DDR[345])\b", name)
            modules_match = re.search(r"(?i)(\d+)\s*[x×]\s*\d+(?:\.\d+)?\s*GB\b", name)
            generation = generation_match.group(1).upper() if generation_match else "Unknown"
            confidence = sum((unit == "GB", generation != "Unknown", parse_speed(name) is not None)) / 3
            output.append(
                RetailProductObservation(
                    observation_id=stable_id(self.source_id, observed, sku, price),
                    observation_date=observed,
                    collected_at=payload.retrieved_at,
                    source_id=self.source_id,
                    retailer="Best Buy",
                    sku=sku,
                    brand=str(row.get("manufacturer", "")),
                    product_name=name,
                    generation=generation,
                    total_capacity_gb=capacity if unit == "GB" else None,
                    module_count=int(modules_match.group(1)) if modules_match else None,
                    speed_mts=parse_speed(name),
                    current_price=price,
                    regular_price=clean_number(row.get("regularPrice")),
                    price_per_gb=price_per_gb(price, capacity, unit),
                    availability="available" if row.get("onlineAvailability") else "unavailable",
                    product_url=str(row.get("url", "")),
                    parsing_confidence=round(confidence, 2),
                )
            )
        return output
