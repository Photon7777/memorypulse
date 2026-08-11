from __future__ import annotations

import json
import os
import re
from datetime import date, datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

from memorypulse.models import RetailProductObservation, stable_id
from memorypulse.sources.base import FetchedPayload, HealthResult, SourceAdapter
from memorypulse.transformations.normalize import parse_capacity, parse_speed, price_per_gb

KEEPA_EPOCH = datetime(2011, 1, 1, tzinfo=timezone.utc)


def _capacity(description: str) -> tuple[float | None, str]:
    capacity, unit = parse_capacity(description)
    kit = re.search(r"(?i)(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*GB\b", description)
    if kit and (capacity is None or capacity == float(kit.group(2))):
        return int(kit.group(1)) * float(kit.group(2)), "GB"
    return capacity, unit


def _month_range(start: date, end: date) -> list[date]:
    output = []
    current = start.replace(day=1)
    final = end.replace(day=1)
    while current <= final:
        output.append(current)
        current = date(current.year + (current.month == 12), 1 if current.month == 12 else current.month + 1, 1)
    return output


class KeepaDdr5PanelSource(SourceAdapter[RetailProductObservation]):
    """Licensed Keepa DDR5 product history, normalized to one in-stock point per month."""

    source_id = "keepa_ddr5_panel"
    source_name = "Keepa licensed DDR5 product panel"

    @property
    def is_enabled(self) -> bool:
        return (
            super().is_enabled
            and bool(os.getenv("KEEPA_API_KEY"))
            and bool(os.getenv("KEEPA_DDR5_ASINS"))
            and os.getenv("KEEPA_PUBLIC_EXPORT_ACKNOWLEDGED", "").lower() == "true"
        )

    def run(self, fixture_path: Any = None) -> tuple[list[RetailProductObservation], HealthResult]:
        if not fixture_path and not self.is_enabled:
            result = HealthResult(
                "disabled",
                "Keepa requires KEEPA_API_KEY, KEEPA_DDR5_ASINS, and explicit public-export acknowledgement",
            )
            self._last_health = result
            return [], result
        return super().run(fixture_path)

    def fetch(self) -> FetchedPayload:
        asins = [value.strip() for value in os.environ["KEEPA_DDR5_ASINS"].split(",") if value.strip()]
        if not asins or len(asins) > int(self.config.get("max_products", 50)):
            raise ValueError("Keepa DDR5 panel must contain between 1 and 50 ASINs")
        params = {
            "key": os.environ["KEEPA_API_KEY"],
            "domain": int(self.config.get("domain", 1)),
            "asin": ",".join(asins),
            "history": 1,
            "days": int(self.config.get("history_days", 2200)),
        }
        original = self.config["url"]
        self.config["url"] = f"{original}?{urlencode(params)}"
        try:
            payload = super().fetch()
            payload.url = str(self.config.get("source_url", "https://keepa.com/#!api"))
            return payload
        finally:
            self.config["url"] = original

    def parse(self, payload: FetchedPayload) -> list[dict[str, Any]]:
        document = json.loads(payload.content.decode("utf-8"))
        products = document.get("products", [])
        if not isinstance(products, list):
            raise ValueError("Keepa response did not contain products")
        return [product for product in products if isinstance(product, dict)]

    def normalize(
        self, rows: list[dict[str, Any]], payload: FetchedPayload
    ) -> list[RetailProductObservation]:
        output = []
        price_index = int(self.config.get("price_history_index", 1))
        for row in rows:
            asin = str(row.get("asin", "")).strip()
            name = str(row.get("title", "")).strip()
            histories = row.get("csv", [])
            if not asin or "DDR5" not in name.upper() or not isinstance(histories, list):
                continue
            history = histories[price_index] if len(histories) > price_index else None
            if not isinstance(history, list) or len(history) < 2:
                continue
            events: list[tuple[datetime, float | None]] = []
            for index in range(0, len(history) - 1, 2):
                try:
                    observed = KEEPA_EPOCH + timedelta(minutes=int(history[index]))
                    raw_price = int(history[index + 1])
                except (TypeError, ValueError):
                    continue
                events.append((observed, raw_price / 100 if raw_price > 0 else None))
            if not events:
                continue
            events.sort(key=lambda item: item[0])
            capacity, unit = _capacity(name)
            modules = re.search(r"(?i)(\d+)\s*[x×]\s*\d+(?:\.\d+)?\s*GB\b", name)
            confidence = sum((unit == "GB", "DDR5" in name.upper(), parse_speed(name) is not None)) / 3
            event_index = 0
            current_price: float | None = None
            for month in _month_range(events[0][0].date(), events[-1][0].date()):
                next_month = date(month.year + (month.month == 12), 1 if month.month == 12 else month.month + 1, 1)
                while event_index < len(events) and events[event_index][0].date() < next_month:
                    current_price = events[event_index][1]
                    event_index += 1
                if current_price is None:
                    continue
                output.append(
                    RetailProductObservation(
                        observation_id=stable_id(self.source_id, asin, month),
                        observation_date=month,
                        collected_at=payload.retrieved_at,
                        source_id=self.source_id,
                        retailer="Amazon via Keepa",
                        sku=asin,
                        brand=str(row.get("manufacturer", "")),
                        product_name=name,
                        generation="DDR5",
                        total_capacity_gb=capacity if unit == "GB" else None,
                        module_count=int(modules.group(1)) if modules else None,
                        speed_mts=parse_speed(name),
                        current_price=current_price,
                        regular_price=None,
                        price_per_gb=price_per_gb(current_price, capacity, unit),
                        availability="historically available",
                        product_url=f"https://www.amazon.com/dp/{asin}",
                        parsing_confidence=round(confidence, 2),
                    )
                )
        return output
