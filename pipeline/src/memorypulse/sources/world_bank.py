from __future__ import annotations

import json
from datetime import date
from typing import Any

from memorypulse.models import MacroIndicatorObservation, stable_id
from memorypulse.sources.base import FetchedPayload, SourceAdapter
from memorypulse.transformations.normalize import clean_number


class WorldBankHighTechExportsSource(SourceAdapter[MacroIndicatorObservation]):
    source_id = "world_bank_high_tech_exports"
    source_name = "World Bank high-technology exports"

    def parse(self, payload: FetchedPayload) -> list[dict[str, Any]]:
        document = json.loads(payload.content.decode("utf-8"))
        if not isinstance(document, list) or len(document) < 2 or not isinstance(document[1], list):
            raise ValueError("World Bank response layout changed")
        return [item for item in document[1] if isinstance(item, dict)]

    def normalize(
        self, rows: list[dict[str, Any]], payload: FetchedPayload
    ) -> list[MacroIndicatorObservation]:
        output = []
        for row in rows:
            value = clean_number(row.get("value"))
            try:
                observed = date(int(row["date"]), 1, 1)
            except (KeyError, TypeError, ValueError):
                continue
            if value is None:
                continue
            series_id = str(row.get("indicator", {}).get("id", self.config["series_id"]))
            output.append(
                MacroIndicatorObservation(
                    observation_id=stable_id(self.source_id, series_id, observed),
                    observation_date=observed,
                    collected_at=payload.retrieved_at,
                    source_id=self.source_id,
                    series_id=series_id,
                    series_name=str(self.config["series_name"]),
                    value=value,
                    unit=str(self.config.get("unit", "current USD")),
                    source_url=payload.url,
                )
            )
        return output
