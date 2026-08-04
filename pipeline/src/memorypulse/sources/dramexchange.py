from __future__ import annotations

import re
from typing import Any

from bs4 import BeautifulSoup

from memorypulse.models import PriceObservation, stable_id
from memorypulse.sources.base import FetchedPayload, SourceAdapter
from memorypulse.transformations.normalize import clean_number, parse_capacity, parse_speed


class DramExchangeHomepageSource(SourceAdapter[PriceObservation]):
    source_id = "dramexchange_homepage"
    source_name = "DRAMeXchange public homepage"
    rate_limit_seconds = 86_400
    max_attempts = 1

    def parse(self, payload: FetchedPayload) -> list[dict[str, Any]]:
        soup = BeautifulSoup(payload.content, "html.parser")
        rows: list[dict[str, Any]] = []
        for table in soup.find_all("table"):
            headers = [cell.get_text(" ", strip=True).lower() for cell in table.find_all("th")]
            header_text = " ".join(headers)
            if "product" not in header_text and "item" not in header_text:
                continue
            if not any(token in header_text for token in ("average", "avg", "high", "low", "price")):
                continue
            for table_row in table.find_all("tr"):
                cells = [cell.get_text(" ", strip=True) for cell in table_row.find_all("td")]
                if len(cells) < 2:
                    continue
                numbers = [clean_number(cell) for cell in cells[1:]]
                numeric = [number for number in numbers if number is not None]
                if not numeric:
                    continue
                rows.append({"description": cells[0], "values": numeric, "headers": headers})
        if len(rows) > 100:
            raise ValueError("public homepage layout produced an unsafe number of rows")
        return rows

    def normalize(
        self, rows: list[dict[str, Any]], payload: FetchedPayload
    ) -> list[PriceObservation]:
        observed = payload.retrieved_at.date()
        records: list[PriceObservation] = []
        for row in rows:
            description = str(row["description"])
            values = list(row["values"])
            average = values[-1]
            high = values[0] if len(values) >= 3 else None
            low = values[1] if len(values) >= 3 else None
            generation_match = re.search(r"(?i)\b(DDR[345]|HBM\w*)\b", description)
            generation = generation_match.group(1).upper() if generation_match else "DRAM"
            capacity, unit = parse_capacity(description)
            records.append(
                PriceObservation(
                    observation_id=stable_id(self.source_id, observed, description, average),
                    observation_date=observed,
                    collected_at=payload.retrieved_at,
                    source_id=self.source_id,
                    market_type="public_spot_homepage",
                    memory_generation=generation,
                    product_type=description,
                    capacity_value=capacity,
                    capacity_unit=unit,
                    speed_mts=parse_speed(description),
                    price_value=average,
                    currency="USD",
                    price_basis="per_chip_or_module_as_labeled",
                    price_per_gb=None,
                    daily_high=high,
                    daily_low=low,
                    session_average=average,
                    source_url=payload.url,
                    source_label=self.source_name,
                    source_reliability=str(self.config.get("reliability", "public_homepage")),
                    raw_description=description,
                    is_estimate=False,
                )
            )
        return records
