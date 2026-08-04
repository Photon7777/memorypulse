from __future__ import annotations

import json
from datetime import date
from typing import Any

from memorypulse.models import MacroIndicatorObservation, stable_id
from memorypulse.sources.base import FetchedPayload, SourceAdapter
from memorypulse.transformations.normalize import clean_number


class BlsSemiconductorEmploymentSource(SourceAdapter[MacroIndicatorObservation]):
    source_id = "bls_semiconductor_employment"
    source_name = "BLS semiconductor employment"

    def parse(self, payload: FetchedPayload) -> list[dict[str, Any]]:
        document = json.loads(payload.content.decode("utf-8"))
        if document.get("status") != "REQUEST_SUCCEEDED":
            raise ValueError("BLS API did not report a successful request")
        series = document.get("Results", {}).get("series", [])
        if not isinstance(series, list) or not series:
            raise ValueError("BLS API response contained no series")
        output: list[dict[str, Any]] = []
        for item in series:
            if not isinstance(item, dict):
                continue
            series_id = str(item.get("seriesID", ""))
            for point in item.get("data", []):
                if isinstance(point, dict):
                    output.append({**point, "series_id": series_id})
        return output

    def normalize(
        self, rows: list[dict[str, Any]], payload: FetchedPayload
    ) -> list[MacroIndicatorObservation]:
        output = []
        for row in rows:
            period = str(row.get("period", ""))
            if not period.startswith("M") or period == "M13":
                continue
            try:
                observed = date(int(row["year"]), int(period[1:]), 1)
            except (KeyError, TypeError, ValueError):
                continue
            value = clean_number(row.get("value"))
            if value is None:
                continue
            series_id = str(row.get("series_id", self.config.get("series_id", "")))
            output.append(
                MacroIndicatorObservation(
                    observation_id=stable_id(self.source_id, series_id, observed),
                    observation_date=observed,
                    collected_at=payload.retrieved_at,
                    source_id=self.source_id,
                    series_id=series_id,
                    series_name=str(self.config["series_name"]),
                    value=value,
                    unit=str(self.config.get("unit", "thousand employees")),
                    source_url=payload.url,
                )
            )
        return output
