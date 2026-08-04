from __future__ import annotations

import json
import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, ClassVar, Generic, TypeVar

import requests

from memorypulse.config import http_timeout, user_agent
from memorypulse.models import utc_now

RecordT = TypeVar("RecordT")
LOGGER = logging.getLogger("memorypulse.sources")


@dataclass(slots=True)
class FetchedPayload:
    content: bytes
    status_code: int
    url: str
    headers: dict[str, str] = field(default_factory=dict)
    retrieved_at: datetime = field(default_factory=utc_now)
    fixture: bool = False


@dataclass(slots=True)
class HealthResult:
    status: str
    reason: str = ""
    records_received: int = 0
    response_status: int | None = None
    freshness_at: datetime | None = None
    records_rejected: int = 0


class SourceAdapter(ABC, Generic[RecordT]):
    source_id: str
    source_name: str
    rate_limit_seconds: float = 1.0
    max_attempts: int = 3
    _last_request_at: ClassVar[dict[str, float]] = {}

    def __init__(self, config: dict[str, Any], root: Path):
        self.config = config
        self.root = root
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": user_agent(), "Accept": "*/*"})
        self._last_health = HealthResult("not_run")
        self._validation_rejections = 0

    @property
    def is_enabled(self) -> bool:
        return bool(self.config.get("enabled", True))

    def fetch(self) -> FetchedPayload:
        url = str(self.config["url"])
        timeout = http_timeout()
        last_error: Exception | None = None
        cache_dir = self.root / "build/http-cache" / self.source_id
        metadata_path = cache_dir / "metadata.json"
        body_path = cache_dir / "response.bin"
        conditional_headers: dict[str, str] = {}
        if metadata_path.exists() and body_path.exists():
            try:
                metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
                if metadata.get("etag"):
                    conditional_headers["If-None-Match"] = metadata["etag"]
                if metadata.get("last_modified"):
                    conditional_headers["If-Modified-Since"] = metadata["last_modified"]
            except (OSError, json.JSONDecodeError):
                conditional_headers = {}
        for attempt in range(self.max_attempts):
            try:
                if attempt:
                    time.sleep(min(2**attempt, 4))
                elapsed = time.monotonic() - self._last_request_at.get(self.source_id, 0.0)
                if elapsed < self.rate_limit_seconds:
                    time.sleep(self.rate_limit_seconds - elapsed)
                response = self.session.get(url, timeout=timeout, headers=conditional_headers)
                self._last_request_at[self.source_id] = time.monotonic()
                if response.status_code == 304 and body_path.exists():
                    return FetchedPayload(
                        content=body_path.read_bytes(),
                        status_code=304,
                        url=response.url,
                        headers={key.lower(): value for key, value in response.headers.items()},
                    )
                response.raise_for_status()
                cache_dir.mkdir(parents=True, exist_ok=True)
                body_path.write_bytes(response.content)
                metadata_path.write_text(
                    json.dumps(
                        {
                            "etag": response.headers.get("ETag"),
                            "last_modified": response.headers.get("Last-Modified"),
                        },
                        sort_keys=True,
                    ),
                    encoding="utf-8",
                )
                return FetchedPayload(
                    content=response.content,
                    status_code=response.status_code,
                    url=response.url,
                    headers={key.lower(): value for key, value in response.headers.items()},
                )
            except requests.RequestException as error:
                last_error = error
                LOGGER.warning("source_fetch_failed", extra={"source_id": self.source_id, "attempt": attempt + 1})
        raise RuntimeError(f"{self.source_name} request failed after limited retries: {last_error}")

    @abstractmethod
    def parse(self, payload: FetchedPayload) -> list[Any]: ...

    @abstractmethod
    def normalize(self, rows: list[Any], payload: FetchedPayload) -> list[RecordT]: ...

    def validate(self, records: list[RecordT]) -> list[RecordT]:
        valid: list[RecordT] = []
        self._validation_rejections = 0
        for record in records:
            try:
                record.validate()  # type: ignore[attr-defined]
                valid.append(record)
            except ValueError:
                self._validation_rejections += 1
                LOGGER.warning(
                    "source_record_rejected",
                    extra={"source_id": self.source_id, "record_type": type(record).__name__},
                )
        return valid

    def freshness_timestamp(self, records: list[RecordT]) -> datetime | None:
        values = []
        for record in records:
            value = getattr(record, "observation_date", None) or getattr(record, "published_at", None)
            if value:
                values.append(value)
        if not values:
            return None
        latest = max(values)
        return latest if isinstance(latest, datetime) else datetime.combine(latest, datetime.min.time(), timezone.utc)

    def health_result(self) -> HealthResult:
        return self._last_health

    def run(self, fixture_path: Path | None = None) -> tuple[list[RecordT], HealthResult]:
        if not self.is_enabled:
            result = HealthResult("disabled", str(self.config.get("disabled_reason", "Disabled in config")))
            self._last_health = result
            return [], result
        try:
            if fixture_path:
                payload = FetchedPayload(fixture_path.read_bytes(), 200, fixture_path.as_uri(), fixture=True)
            else:
                payload = self.fetch()
            rows = self.parse(payload)
            records = self.validate(self.normalize(rows, payload))
            status = "success" if records else "degraded"
            reason = "" if records else "Source returned zero valid rows"
            result = HealthResult(
                status,
                reason,
                len(rows),
                payload.status_code,
                self.freshness_timestamp(records),
                self._validation_rejections,
            )
        except Exception as error:  # an adapter cannot take down the rest of the pipeline
            LOGGER.exception("source_run_failed", extra={"source_id": self.source_id})
            records = []
            result = HealthResult("degraded", str(error)[:500])
        self._last_health = result
        return records, result
