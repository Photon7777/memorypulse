from __future__ import annotations

import json
from datetime import date
from typing import Any

from memorypulse.models import MacroIndicatorObservation, stable_id
from memorypulse.sources.base import FetchedPayload, SourceAdapter


class SecMemorySupplierSource(SourceAdapter[MacroIndicatorObservation]):
    source_id = "sec_memory_supplier_fundamentals"
    source_name = "SEC EDGAR memory-supplier fundamentals"

    def parse(self, payload: FetchedPayload) -> list[dict[str, Any]]:
        document = json.loads(payload.content.decode("utf-8"))
        facts = document.get("facts", {}).get("us-gaap", {})
        if not isinstance(facts, dict):
            raise ValueError("SEC Company Facts response did not contain us-gaap facts")
        rows: list[dict[str, Any]] = []
        for configured in self.config.get("facts", []):
            tag = str(configured["tag"])
            unit = str(configured.get("unit", "USD"))
            entries = facts.get(tag, {}).get("units", {}).get(unit, [])
            if not isinstance(entries, list):
                continue
            for entry in entries:
                if isinstance(entry, dict):
                    rows.append({**entry, "tag": tag, "unit": unit, "name": configured["name"]})
        return rows

    def normalize(
        self, rows: list[dict[str, Any]], payload: FetchedPayload
    ) -> list[MacroIndicatorObservation]:
        latest_by_period: dict[tuple[str, date], dict[str, Any]] = {}
        for row in rows:
            if str(row.get("form", "")) not in {"10-Q", "10-K"} or not row.get("frame"):
                continue
            try:
                observed = date.fromisoformat(str(row["end"]))
                float(row["val"])
            except (KeyError, TypeError, ValueError):
                continue
            key = (str(row["tag"]), observed)
            if key not in latest_by_period or str(row.get("filed", "")) > str(latest_by_period[key].get("filed", "")):
                latest_by_period[key] = row

        output = []
        company = str(self.config.get("company", "Memory supplier"))
        for (tag, observed), row in sorted(latest_by_period.items(), key=lambda item: item[0]):
            series_id = f"SEC_{str(self.config.get('ticker', 'SUPPLIER')).upper()}_{tag}"
            output.append(
                MacroIndicatorObservation(
                    observation_id=stable_id(self.source_id, series_id, observed),
                    observation_date=observed,
                    collected_at=payload.retrieved_at,
                    source_id=self.source_id,
                    series_id=series_id,
                    series_name=f"{company} — {row['name']}",
                    value=float(row["val"]),
                    unit=str(row["unit"]),
                    source_url=payload.url,
                )
            )
        return output
