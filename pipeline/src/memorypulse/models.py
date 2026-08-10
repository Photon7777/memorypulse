from __future__ import annotations

import hashlib
from dataclasses import asdict, dataclass, fields
from datetime import date, datetime, timedelta, timezone
from typing import Any


class ValidationError(ValueError):
    """Raised when a normalized record violates the public data contract."""


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def stable_id(prefix: str, *parts: object) -> str:
    canonical = "|".join(str(part).strip().lower() for part in parts)
    return f"{prefix}_{hashlib.sha256(canonical.encode()).hexdigest()[:20]}"


def _serialized(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat().replace("+00:00", "Z")
    if isinstance(value, list):
        return [_serialized(item) for item in value]
    if isinstance(value, bool):
        return "true" if value else "false"
    return value


@dataclass(slots=True)
class Contract:
    def to_record(self) -> dict[str, Any]:
        return {key: _serialized(value) for key, value in asdict(self).items()}

    @classmethod
    def columns(cls) -> list[str]:
        return [field.name for field in fields(cls)]


def validate_observation_date(value: date) -> None:
    if value > date.today() + timedelta(days=2):
        raise ValidationError("observation date is unreasonably far in the future")


@dataclass(slots=True)
class PriceObservation(Contract):
    observation_id: str
    observation_date: date
    collected_at: datetime
    source_id: str
    market_type: str
    memory_generation: str
    product_type: str
    capacity_value: float | None
    capacity_unit: str
    speed_mts: int | None
    price_value: float
    currency: str
    price_basis: str
    price_per_gb: float | None
    daily_high: float | None
    daily_low: float | None
    session_average: float | None
    source_url: str
    source_label: str
    source_reliability: str
    raw_description: str
    is_estimate: bool

    def validate(self) -> None:
        validate_observation_date(self.observation_date)
        if self.price_value <= 0:
            raise ValidationError("price must be positive")
        if self.capacity_unit not in {"GB", "Gb", "", "unknown"}:
            raise ValidationError(f"unsupported capacity unit: {self.capacity_unit}")
        if self.price_per_gb is not None:
            explicit_per_gb = self.price_basis.upper() in {"USD/GB", "PER_GB", "PRICE_PER_GB"}
            if not explicit_per_gb and (self.capacity_unit != "GB" or not self.capacity_value):
                raise ValidationError("price per GB requires an unambiguous positive GB capacity")
            if self.price_per_gb <= 0:
                raise ValidationError("price per GB must be positive")


@dataclass(slots=True)
class RetailProductObservation(Contract):
    observation_id: str
    observation_date: date
    collected_at: datetime
    source_id: str
    retailer: str
    sku: str
    brand: str
    product_name: str
    generation: str
    total_capacity_gb: float | None
    module_count: int | None
    speed_mts: int | None
    current_price: float
    regular_price: float | None
    price_per_gb: float | None
    availability: str
    product_url: str
    parsing_confidence: float

    def validate(self) -> None:
        validate_observation_date(self.observation_date)
        if self.current_price <= 0:
            raise ValidationError("retail price must be positive")
        if not 0 <= self.parsing_confidence <= 1:
            raise ValidationError("parsing confidence must be between 0 and 1")


@dataclass(slots=True)
class ElectronicsPriceObservation(Contract):
    observation_id: str
    observation_date: date
    collected_at: datetime
    category: str
    manufacturer: str
    product_family: str
    model: str
    configuration: str
    price_type: str
    price_usd: float
    memory_gb: float | None
    storage_gb: float | None
    comparability: str
    source_id: str
    source_url: str
    source_label: str
    notes: str

    def validate(self) -> None:
        validate_observation_date(self.observation_date)
        if self.price_usd <= 0:
            raise ValidationError("electronics price must be positive")
        if self.price_type not in {"launch_msrp", "official_msrp", "announced_msrp"}:
            raise ValidationError(f"unsupported electronics price type: {self.price_type}")
        if self.comparability not in {"like_for_like", "same_product_family", "starting_price_tier"}:
            raise ValidationError(f"unsupported electronics comparability: {self.comparability}")


@dataclass(slots=True)
class DeviceExposureAssumption(Contract):
    exposure_id: str
    category: str
    display_name: str
    memory_storage_share_low: float
    memory_storage_share_central: float
    memory_storage_share_high: float
    pass_through_low: float
    pass_through_central: float
    pass_through_high: float
    basis: str
    source_label: str

    def validate(self) -> None:
        shares = (
            self.memory_storage_share_low,
            self.memory_storage_share_central,
            self.memory_storage_share_high,
            self.pass_through_low,
            self.pass_through_central,
            self.pass_through_high,
        )
        if any(value < 0 or value > 1 for value in shares):
            raise ValidationError("device exposure shares must be between zero and one")
        if not self.memory_storage_share_low <= self.memory_storage_share_central <= self.memory_storage_share_high:
            raise ValidationError("device component-share range is not ordered")
        if not self.pass_through_low <= self.pass_through_central <= self.pass_through_high:
            raise ValidationError("device pass-through range is not ordered")


@dataclass(slots=True)
class MacroIndicatorObservation(Contract):
    observation_id: str
    observation_date: date
    collected_at: datetime
    source_id: str
    series_id: str
    series_name: str
    value: float
    unit: str
    source_url: str

    def validate(self) -> None:
        validate_observation_date(self.observation_date)


@dataclass(slots=True)
class NewsEvent(Contract):
    event_id: str
    published_at: datetime
    collected_at: datetime
    title: str
    source_domain: str
    source_name: str
    article_url: str
    query_category: str
    companies: list[str]
    memory_types: list[str]
    event_tags: list[str]
    short_excerpt: str
    relevance_score: float
    duplicate_group_id: str
    manually_important: bool = False

    def validate(self) -> None:
        if not self.title or not self.article_url:
            raise ValidationError("news metadata requires a title and URL")
        if not 0 <= self.relevance_score <= 1:
            raise ValidationError("relevance score must be between 0 and 1")
        if len(self.short_excerpt) > 500:
            raise ValidationError("short excerpt exceeds the metadata-only limit")


@dataclass(slots=True)
class SourceRun(Contract):
    run_id: str
    source_id: str
    started_at: datetime
    completed_at: datetime
    status: str
    records_received: int
    records_written: int
    records_rejected: int
    response_status: int | None
    failure_reason: str
    data_freshness_at: datetime | None
    duration_seconds: float
    optional_key_configured: bool = False


@dataclass(slots=True)
class MarketIndexObservation(Contract):
    observation_date: date
    calculated_at: datetime
    total_score: float
    status_label: str
    confidence_score: float
    spot_momentum_score: float | None
    retail_momentum_score: float | None
    volatility_score: float | None
    news_pressure_score: float | None
    macro_pressure_score: float | None
    methodology_version: str


@dataclass(slots=True)
class ForecastObservation(Contract):
    forecast_created_at: datetime
    target_date: date
    series_id: str
    model_name: str
    model_version: str
    point_forecast: float
    lower_bound: float
    upper_bound: float
    training_start: date
    training_end: date
    backtest_mae: float
    backtest_mape: float | None
    observations_used: int
    data_frequency: str


@dataclass(slots=True)
class DecisionBriefObservation(Contract):
    brief_id: str
    generated_at: datetime
    regime: str
    direction: str
    confidence: str
    confidence_score: float
    pressure_score: float
    procurement_posture: str
    inventory_posture: str
    budget_risk: str
    conclusion: str
    methodology_version: str

    def validate(self) -> None:
        if not 0 <= self.confidence_score <= 1:
            raise ValidationError("decision confidence must be between 0 and 1")
        if not 0 <= self.pressure_score <= 100:
            raise ValidationError("decision pressure score must be between 0 and 100")
        if not self.conclusion:
            raise ValidationError("decision brief requires a conclusion")
