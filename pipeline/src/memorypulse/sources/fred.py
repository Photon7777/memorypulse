from __future__ import annotations

import csv
import io
from datetime import date
from typing import Any

from memorypulse.models import MacroIndicatorObservation, stable_id
from memorypulse.sources.base import FetchedPayload, SourceAdapter
from memorypulse.transformations.normalize import clean_number


class FredSemiconductorSource(SourceAdapter[MacroIndicatorObservation]):
    source_id = "fred_semiconductor"
    source_name = "FRED semiconductor indicators"

    def __init__(self, config: dict[str, Any], root: Any):
        super().__init__(config, root)
        series = config.get("series", [])
        if not series:
            raise ValueError("at least one FRED series must be configured")
        self.series = series[0]
        self.config["url"] = str(config["url_template"]).format(series_id=self.series["id"])

    def parse(self, payload: FetchedPayload) -> list[dict[str, str]]:
        reader = csv.DictReader(io.StringIO(payload.content.decode("utf-8-sig")))
        series_id = str(self.series["id"])
        if not reader.fieldnames or "observation_date" not in reader.fieldnames or series_id not in reader.fieldnames:
            raise ValueError("FRED CSV layout changed")
        return [dict(row) for row in reader]

    def normalize(
        self, rows: list[dict[str, str]], payload: FetchedPayload
    ) -> list[MacroIndicatorObservation]:
        output = []
        series_id = str(self.series["id"])
        for row in rows:
            value = clean_number(row.get(series_id))
            if value is None:
                continue
            try:
                observed = date.fromisoformat(row["observation_date"])
            except (KeyError, ValueError):
                continue
            output.append(
                MacroIndicatorObservation(
                    observation_id=stable_id(self.source_id, series_id, observed),
                    observation_date=observed,
                    collected_at=payload.retrieved_at,
                    source_id=self.source_id,
                    series_id=series_id,
                    series_name=str(self.series["name"]),
                    value=value,
                    unit=str(self.series.get("unit", "index")),
                    source_url=payload.url,
                )
            )
        return output
