from __future__ import annotations

import io
from datetime import date

import polars as pl

from memorypulse.models import PriceObservation, stable_id
from memorypulse.sources.base import FetchedPayload, SourceAdapter
from memorypulse.transformations.normalize import clean_number, parse_capacity, parse_speed


class StanfordMemoryPricesSource(SourceAdapter[PriceObservation]):
    source_id = "stanford_memory_prices"
    source_name = "Stanford Memory Price Data"

    def parse(self, payload: FetchedPayload) -> list[dict[str, str]]:
        frame = pl.read_csv(
            io.BytesIO(payload.content),
            infer_schema_length=0,
            null_values=["", "NA", "N/A"],
        )
        required = {"date", "category", "series", "metric", "value", "unit", "source"}
        if not required.issubset(frame.columns):
            raise ValueError("Stanford CSV layout does not match the expected public schema")
        return [
            {str(key): "" if value is None else str(value) for key, value in row.items()}
            for row in frame.to_dicts()
        ]

    def normalize(
        self, rows: list[dict[str, str]], payload: FetchedPayload
    ) -> list[PriceObservation]:
        records: list[PriceObservation] = []
        for row in rows:
            value = clean_number(row.get("value"))
            if value is None or value <= 0:
                continue
            try:
                observed = date.fromisoformat(row["date"])
            except (KeyError, ValueError):
                continue
            series = row.get("series", "Unknown series").strip()
            representative = row.get("representative", "").strip()
            notes = row.get("notes", "").strip()
            searchable = f"{row.get('category', '')} {series} {representative}".upper()
            generation = next(
                (name for name in ("DDR5", "DDR4", "DDR3", "HBM", "NAND", "DRAM") if name in searchable),
                row.get("category", "Unknown").strip() or "Unknown",
            )
            capacity, unit = parse_capacity(representative)
            metric = row.get("metric", "").strip()
            source_attribution = row.get("source", "Stanford dataset").strip()
            explicit_per_gb = metric.lower() == "usd_per_gb" or row.get("unit", "").upper() == "USD/GB"
            estimate = "estimate" in f"{notes} {source_attribution}".lower() or generation == "HBM"
            identity = stable_id(self.source_id, observed, series, metric, value, source_attribution)
            records.append(
                PriceObservation(
                    observation_id=identity,
                    observation_date=observed,
                    collected_at=payload.retrieved_at,
                    source_id=self.source_id,
                    market_type="historical_research",
                    memory_generation=generation,
                    product_type=series,
                    capacity_value=capacity,
                    capacity_unit=unit,
                    speed_mts=parse_speed(representative),
                    price_value=value,
                    currency="USD" if "USD" in row.get("unit", "").upper() else row.get("unit", ""),
                    price_basis="USD/GB" if explicit_per_gb else metric,
                    price_per_gb=value if explicit_per_gb else None,
                    daily_high=None,
                    daily_low=None,
                    session_average=None,
                    source_url=payload.url,
                    source_label=f"Stanford dataset; underlying source: {source_attribution}",
                    source_reliability=str(self.config.get("reliability", "research_dataset")),
                    raw_description=" | ".join(part for part in (series, representative, notes) if part),
                    is_estimate=estimate,
                )
            )
        return records
