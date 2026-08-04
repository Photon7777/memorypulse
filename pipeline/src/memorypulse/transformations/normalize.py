from __future__ import annotations

import re
from collections.abc import Iterable
from typing import Any

import numpy as np

from memorypulse.models import PriceObservation

CAPACITY_PATTERN = re.compile(r"(?i)(\d+(?:\.\d+)?)\s*(GB|Gb)\b")
SPEED_PATTERN = re.compile(r"(?i)(\d{3,5})\s*(?:MT/s|MHz)\b")


def parse_capacity(description: str) -> tuple[float | None, str]:
    """Return capacity without conflating gigabits (Gb) and gigabytes (GB)."""
    match = CAPACITY_PATTERN.search(description)
    if not match:
        return None, "unknown"
    value = float(match.group(1))
    unit = match.group(2)
    return value, "GB" if unit == "GB" else "Gb"


def parse_speed(description: str) -> int | None:
    match = SPEED_PATTERN.search(description)
    return int(match.group(1)) if match else None


def price_per_gb(price: float, capacity: float | None, unit: str) -> float | None:
    if capacity is None or capacity <= 0 or unit != "GB":
        return None
    return round(price / capacity, 6)


def flag_outliers(values: Iterable[float], threshold: float = 6.0) -> list[bool]:
    data = np.asarray(list(values), dtype=float)
    if len(data) < 4:
        return [False] * len(data)
    median = float(np.median(data))
    mad = float(np.median(np.abs(data - median)))
    if mad == 0:
        return [False] * len(data)
    robust_z = 0.6745 * np.abs(data - median) / mad
    return [bool(value > threshold) for value in robust_z]


def deduplicate_prices(records: list[PriceObservation]) -> list[PriceObservation]:
    unique: dict[str, PriceObservation] = {}
    for record in records:
        record.validate()
        unique.setdefault(record.observation_id, record)
    return sorted(unique.values(), key=lambda item: (item.observation_date, item.observation_id))


def clean_number(value: Any) -> float | None:
    if value is None:
        return None
    text = str(value).strip().replace("$", "").replace(",", "")
    if text in {"", ".", "NA", "N/A", "null", "None"}:
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    return number if np.isfinite(number) else None
