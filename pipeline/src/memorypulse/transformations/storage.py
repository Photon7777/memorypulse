from __future__ import annotations

import csv
import json
import os
import tempfile
from collections.abc import Iterable
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from memorypulse.models import (
    DecisionBriefObservation,
    ForecastObservation,
    MacroIndicatorObservation,
    MarketIndexObservation,
    PriceObservation,
    RetailProductObservation,
    SourceRun,
)

HISTORY_CONTRACTS = {
    "spot_prices.csv": PriceObservation,
    "memory_prices.csv": PriceObservation,
    "retail_products.csv": RetailProductObservation,
    "macro_indicators.csv": MacroIndicatorObservation,
    "forecasts.csv": ForecastObservation,
    "market_index.csv": MarketIndexObservation,
    "source_runs.csv": SourceRun,
    "decision_briefs.csv": DecisionBriefObservation,
}


def atomic_write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def ensure_history_files(history_dir: Path) -> None:
    history_dir.mkdir(parents=True, exist_ok=True)
    for filename, contract in HISTORY_CONTRACTS.items():
        path = history_dir / filename
        if not path.exists():
            atomic_write_text(path, ",".join(contract.columns()) + "\n")
    news = history_dir / "news_events.ndjson"
    if not news.exists():
        atomic_write_text(news, "")


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def append_csv_records(
    path: Path, records: Iterable[Any], key: str | tuple[str, ...]
) -> tuple[int, int]:
    records = list(records)
    if not records:
        return 0, 0
    existing = read_csv_rows(path)
    keys = (key,) if isinstance(key, str) else key
    def identity_for(row: dict[str, Any]) -> str:
        return "|".join(str(row[name]) for name in keys)

    by_key = {identity_for(row): row for row in existing}
    written = 0
    rejected = 0
    for item in records:
        if hasattr(item, "validate"):
            item.validate()
        record = item.to_record() if hasattr(item, "to_record") else dict(item)
        record = {column: "" if value is None else value for column, value in record.items()}
        identity = identity_for(record)
        if identity in by_key:
            rejected += 1
            continue
        by_key[identity] = record
        written += 1
    fieldnames = next(iter(by_key.values())).keys() if by_key else records[0].columns()
    lines: list[str] = []
    import io

    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=fieldnames, lineterminator="\n")
    writer.writeheader()
    writer.writerows(sorted(by_key.values(), key=lambda row: tuple(str(v) for v in row.values())))
    lines.append(output.getvalue())
    atomic_write_text(path, "".join(lines))
    return written, rejected


def read_ndjson(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def append_news(path: Path, records: Iterable[Any], now: datetime | None = None) -> tuple[int, int]:
    current = now or datetime.now(timezone.utc)
    cutoff = current - timedelta(days=365)
    existing = read_ndjson(path)
    by_id: dict[str, dict[str, Any]] = {}
    for row in existing:
        published = datetime.fromisoformat(row["published_at"].replace("Z", "+00:00"))
        if row.get("manually_important") or published >= cutoff:
            by_id[row["event_id"]] = row
    written = rejected = 0
    for item in records:
        item.validate()
        record = item.to_record()
        if record["event_id"] in by_id:
            rejected += 1
        else:
            by_id[record["event_id"]] = record
            written += 1
    content = "".join(
        json.dumps(row, ensure_ascii=False, sort_keys=True, allow_nan=False) + "\n"
        for row in sorted(by_id.values(), key=lambda row: (row["published_at"], row["event_id"]))
    )
    atomic_write_text(path, content)
    return written, rejected
