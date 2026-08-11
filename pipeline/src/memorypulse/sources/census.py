from __future__ import annotations

import json
import os
from datetime import date
from typing import Any
from urllib.parse import urlencode

from memorypulse.models import MacroIndicatorObservation, stable_id
from memorypulse.sources.base import FetchedPayload, HealthResult, SourceAdapter


class CensusMemoryTradeSource(SourceAdapter[MacroIndicatorObservation]):
    """Monthly U.S. trade value for HS 854232, electronic integrated-circuit memories."""

    source_id = "census_memory_trade"
    source_name = "U.S. Census memory integrated-circuit trade"

    @property
    def is_enabled(self) -> bool:
        return super().is_enabled and bool(os.getenv("CENSUS_API_KEY"))

    def run(self, fixture_path: Any = None) -> tuple[list[MacroIndicatorObservation], HealthResult]:
        if not fixture_path and not os.getenv("CENSUS_API_KEY"):
            result = HealthResult("disabled", "Optional CENSUS_API_KEY is not configured")
            self._last_health = result
            return [], result
        return super().run(fixture_path)

    def fetch(self) -> FetchedPayload:
        direction = str(self.config["direction"])
        commodity_field = "I_COMMODITY" if direction == "imports" else "E_COMMODITY"
        label_field = f"{commodity_field}_LABEL"
        value_field = "GEN_VAL_MO" if direction == "imports" else "ALL_VAL_MO"
        params = {
            "get": f"{label_field},{commodity_field},YEAR,MONTH,{value_field}",
            "for": "world:1",
            "time": f"from {self.config.get('start_month', '2010-01')}",
            commodity_field: str(self.config.get("commodity_code", "854232")),
            "key": os.environ["CENSUS_API_KEY"],
        }
        original = self.config["url"]
        self.config["url"] = f"{original}?{urlencode(params)}"
        try:
            payload = super().fetch()
            payload.url = str(self.config.get("source_url", original))
            return payload
        finally:
            self.config["url"] = original

    def parse(self, payload: FetchedPayload) -> list[dict[str, Any]]:
        document = json.loads(payload.content.decode("utf-8"))
        if not isinstance(document, list) or len(document) < 2 or not isinstance(document[0], list):
            raise ValueError("Census trade response did not contain a tabular result")
        headers = [str(value) for value in document[0]]
        return [
            dict(zip(headers, row, strict=False))
            for row in document[1:]
            if isinstance(row, list)
        ]

    def normalize(
        self, rows: list[dict[str, Any]], payload: FetchedPayload
    ) -> list[MacroIndicatorObservation]:
        direction = str(self.config["direction"])
        value_field = "GEN_VAL_MO" if direction == "imports" else "ALL_VAL_MO"
        series_id = f"CENSUS_HS854232_{direction.upper()}_VALUE"
        output = []
        for row in rows:
            try:
                observed = date(int(row["YEAR"]), int(row["MONTH"]), 1)
                value = float(row[value_field])
            except (KeyError, TypeError, ValueError):
                continue
            if value < 0:
                continue
            output.append(
                MacroIndicatorObservation(
                    observation_id=stable_id(self.source_id, series_id, observed),
                    observation_date=observed,
                    collected_at=payload.retrieved_at,
                    source_id=self.source_id,
                    series_id=series_id,
                    series_name=f"U.S. monthly {direction} of memory integrated circuits (HS 854232)",
                    value=value,
                    unit="current USD",
                    source_url=payload.url,
                )
            )
        return output


class CensusMemoryImportsSource(CensusMemoryTradeSource):
    source_id = "census_memory_imports"
    source_name = "U.S. Census memory integrated-circuit imports"


class CensusMemoryExportsSource(CensusMemoryTradeSource):
    source_id = "census_memory_exports"
    source_name = "U.S. Census memory integrated-circuit exports"
