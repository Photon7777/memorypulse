from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date
from itertools import pairwise
from typing import Any

import duckdb
import numpy as np

from memorypulse.models import MarketIndexObservation, utc_now


@dataclass(slots=True)
class ComponentResult:
    key: str
    score: float | None
    raw_inputs: dict[str, float | int | None]
    transformation: str
    coverage: float

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class IndexResult:
    observation: MarketIndexObservation
    components: list[ComponentResult]
    insights: list[str]


def robust_percentile_score(value: float | None, baseline: list[float]) -> float | None:
    if value is None or not np.isfinite(value) or len(baseline) < 3:
        return None
    data = np.asarray([item for item in baseline if np.isfinite(item)], dtype=float)
    if len(data) < 3:
        return None
    low, high = np.percentile(data, [10, 90])
    if high <= low:
        return 50.0
    return round(float(np.clip((value - low) / (high - low) * 100, 0, 100)), 2)


def status_label(score: float) -> str:
    if score < 25:
        return "Normal"
    if score < 50:
        return "Moderate Pressure"
    if score < 75:
        return "Elevated Pressure"
    return "Severe Pressure"


def _series(connection: duckdb.DuckDBPyConnection, query: str) -> list[float]:
    return [float(row[0]) for row in connection.execute(query).fetchall() if row[0] is not None]


def components_from_database(connection: duckdb.DuckDBPyConnection) -> list[ComponentResult]:
    price_values = _series(
        connection,
        "SELECT avg(price_value) FROM memory_prices GROUP BY observation_date ORDER BY observation_date",
    )
    spot_values = _series(
        connection,
        "SELECT avg(coalesce(session_average, price_value)) FROM spot_prices GROUP BY observation_date ORDER BY observation_date",
    )
    retail_values = _series(
        connection,
        "SELECT median(price_per_gb) FROM retail_products WHERE parsing_confidence >= .7 GROUP BY observation_date ORDER BY observation_date",
    )
    macro_values = _series(
        connection,
        """SELECT avg(value) FROM macro_indicators
        WHERE series_id = 'PCU3344133441'
        GROUP BY observation_date ORDER BY observation_date""",
    )
    news_values = _series(
        connection,
        "SELECT count(*) FROM news_events GROUP BY published_at::DATE ORDER BY published_at::DATE",
    )

    def changes(values: list[float]) -> list[float]:
        return [100 * (current / previous - 1) for previous, current in pairwise(values) if previous]

    combined_spot = spot_values or price_values
    spot_changes = changes(combined_spot)
    retail_changes = changes(retail_values)
    macro_changes = changes(macro_values)
    volatility = [float(np.std(combined_spot[max(0, index - 5) : index + 1])) for index in range(2, len(combined_spot))]
    return [
        ComponentResult(
            "spot_momentum",
            robust_percentile_score(spot_changes[-1] if spot_changes else None, spot_changes[:-1]),
            {"latest_percent_change": spot_changes[-1] if spot_changes else None, "observations": len(combined_spot)},
            "10th to 90th percentile normalization of period-over-period price momentum",
            min(1.0, len(combined_spot) / 12),
        ),
        ComponentResult(
            "retail_momentum",
            robust_percentile_score(retail_changes[-1] if retail_changes else None, retail_changes[:-1]),
            {"latest_percent_change": retail_changes[-1] if retail_changes else None, "observations": len(retail_values)},
            "10th to 90th percentile normalization of retail median price-per-GB momentum",
            min(1.0, len(retail_values) / 12),
        ),
        ComponentResult(
            "volatility",
            robust_percentile_score(volatility[-1] if volatility else None, volatility[:-1]),
            {"latest_rolling_stddev": volatility[-1] if volatility else None, "observations": len(combined_spot)},
            "10th to 90th percentile normalization of rolling price standard deviation",
            min(1.0, len(volatility) / 10),
        ),
        ComponentResult(
            "news_pressure",
            robust_percentile_score(news_values[-1] if news_values else None, news_values[:-1]),
            {"latest_daily_events": int(news_values[-1]) if news_values else None, "days": len(news_values)},
            "10th to 90th percentile normalization of relevant daily article counts",
            min(1.0, len(news_values) / 30),
        ),
        ComponentResult(
            "macro_pressure",
            robust_percentile_score(macro_changes[-1] if macro_changes else None, macro_changes[:-1]),
            {"latest_percent_change": macro_changes[-1] if macro_changes else None, "observations": len(macro_values)},
            "10th to 90th percentile normalization of semiconductor producer-price-index changes",
            min(1.0, len(macro_values) / 12),
        ),
    ]


def calculate_index(
    components: list[ComponentResult], weights: dict[str, float], methodology_version: str, observed: date
) -> IndexResult:
    available = [component for component in components if component.score is not None]
    represented_weight = sum(weights[component.key] for component in available)
    total = (
        sum(float(component.score) * weights[component.key] for component in available) / represented_weight
        if represented_weight
        else 0.0
    )
    confidence = round(represented_weight / sum(weights.values()), 4) if weights else 0.0
    score = round(total, 2)
    lookup = {component.key: component.score for component in components}
    observation = MarketIndexObservation(
        observation_date=observed,
        calculated_at=utc_now(),
        total_score=score,
        status_label=status_label(score),
        confidence_score=confidence,
        spot_momentum_score=lookup.get("spot_momentum"),
        retail_momentum_score=lookup.get("retail_momentum"),
        volatility_score=lookup.get("volatility"),
        news_pressure_score=lookup.get("news_pressure"),
        macro_pressure_score=lookup.get("macro_pressure"),
        methodology_version=methodology_version,
    )
    insights = []
    spot = next(component for component in components if component.key == "spot_momentum")
    if spot.raw_inputs.get("latest_percent_change") is not None:
        direction = "increased" if float(spot.raw_inputs["latest_percent_change"]) > 0 else "declined"
        insights.append(f"Observed memory-price momentum {direction} in the latest comparable period.")
    missing = [component.key.replace("_", " ") for component in components if component.score is None]
    if missing:
        insights.append(f"The index has reduced confidence because {', '.join(missing)} data is unavailable.")
    news = next(component for component in components if component.key == "news_pressure")
    if news.score is not None and news.score >= 75:
        insights.append("Relevant news-event intensity is above its trailing baseline.")
    if not insights:
        insights.append("Additional comparable history is needed before directional insights are published.")
    return IndexResult(observation, components, insights)
