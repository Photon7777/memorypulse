from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode, urlparse, urlunparse

from memorypulse.models import NewsEvent, stable_id
from memorypulse.sources.base import FetchedPayload, SourceAdapter

QUERIES = [
    "DRAM",
    "DDR4",
    "DDR5",
    "HBM",
    '"high bandwidth memory"',
    '"memory shortage"',
    '"semiconductor memory"',
    '"AI memory demand"',
    '"Samsung memory"',
    '"SK hynix memory"',
    '"Micron memory"',
    '"base RAM"',
    '"RAM configuration"',
    '"memory configuration"',
    '"8GB RAM" laptop',
    '"12GB RAM" phone',
    '"device price increase"',
    '"component costs" electronics',
    '"console price"',
    '"laptop price" memory',
    '"smartphone price" memory',
    '"graphics card" VRAM price',
]
TAG_RULES = {
    "supply expansion": ("supply expansion", "increase output", "capacity expansion"),
    "production cut": ("production cut", "cut production", "output cut"),
    "capacity allocation": ("capacity allocation", "prioritization", "prioritize hbm"),
    "price increase": ("price increase", "price hike", "prices rise", "higher prices"),
    "price decline": ("price decline", "price drop", "prices fall", "lower prices"),
    "HBM investment": ("hbm investment", "invest in hbm", "hbm spending"),
    "factory construction": ("new fab", "factory construction", "build a plant"),
    "earnings guidance": ("earnings guidance", "outlook", "revenue guidance"),
    "shortage": ("shortage", "tight supply", "supply constraint"),
    "inventory": ("inventory", "stockpile"),
    "RAM reduction": ("less ram", "reduced ram", "ram reduction", "cut ram", "base ram"),
    "configuration change": ("configuration", "base model", "entry model", "starting model"),
    "storage change": ("storage change", "ssd capacity", "base storage"),
    "consumer price pressure": ("price increase", "higher price", "more expensive", "price hike"),
    "tariff or trade policy": ("tariff", "export control", "trade restriction"),
    "product launch": ("launches", "unveils", "announces", "introduced"),
}
COMPANY_RULES = {
    "Samsung": ("samsung",),
    "SK hynix": ("sk hynix", "skhynix"),
    "Micron": ("micron",),
    "Apple": ("apple", "iphone", "macbook", "ipad"),
    "Google": ("google pixel", "pixel 11", "pixel 10"),
    "Microsoft": ("microsoft", "surface", "xbox"),
    "Sony": ("sony", "playstation", "ps5"),
    "Nintendo": ("nintendo", "switch 2"),
    "Dell": ("dell", "xps"),
    "Lenovo": ("lenovo", "thinkpad", "legion go"),
    "HP": (" hp ", "hewlett-packard", "omnibook"),
    "Asus": ("asus", "rog ally", "zenbook"),
    "Acer": ("acer", "predator"),
    "Nvidia": ("nvidia", "geforce", "rtx"),
    "AMD": ("amd", "radeon"),
    "Intel": ("intel", "arc gpu"),
}
MEMORY_RULES = {
    "DDR4": ("ddr4",),
    "DDR5": ("ddr5",),
    "HBM": ("hbm", "high bandwidth memory"),
    "DRAM": ("dram",),
}
DEVICE_TERMS = (
    "pixel", "iphone", "galaxy", "macbook", "surface", "xps", "thinkpad", "laptop",
    "playstation", "ps5", "xbox", "switch 2", "steam deck", "rog ally", "ipad",
    "tablet", "geforce", "radeon", "graphics card",
)
CONFIGURATION_TERMS = (
    "ram", "memory configuration", "base model", "entry model", "storage", "price increase",
    "price hike", "more expensive", "starting price",
)
POLICY_TERMS = ("tariff", "export control", "trade restriction", "subsidy", "regulation")


def query_lane(text: str) -> str:
    if any(token in text for token in POLICY_TERMS):
        return "market_policy"
    if any(token in text for token in DEVICE_TERMS):
        if any(token in text for token in CONFIGURATION_TERMS):
            return "device_configuration"
        if any(token in text for token in ("launches", "unveils", "announces", "introduced")):
            return "official_product"
    return "upstream_memory"


def canonical_url(value: str) -> str:
    parsed = urlparse(value.strip())
    host = parsed.netloc.lower().removeprefix("www.")
    path = parsed.path.rstrip("/") or "/"
    return urlunparse((parsed.scheme.lower() or "https", host, path, "", "", ""))


def _published(value: str, fallback: datetime) -> datetime:
    candidates = ("%Y%m%dT%H%M%SZ", "%Y%m%d%H%M%S", "%Y-%m-%dT%H:%M:%SZ")
    for pattern in candidates:
        try:
            return datetime.strptime(value, pattern).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return fallback


class GdeltMemoryNewsSource(SourceAdapter[NewsEvent]):
    source_id = "gdelt_memory_news"
    source_name = "GDELT DOC API"
    # GDELT may return 429 for repeated requests. One bounded attempt per daily run
    # avoids turning a rate-limit response into additional traffic.
    max_attempts = 1

    def fetch(self) -> FetchedPayload:
        params = {
            "query": f"({' OR '.join(QUERIES)}) sourcelang:english",
            "mode": "ArtList",
            "maxrecords": int(self.config.get("max_records", 50)),
            "format": "json",
            "timespan": "1d",
            "sort": "DateDesc",
        }
        original = self.config["url"]
        self.config["url"] = f"{original}?{urlencode(params)}"
        try:
            return super().fetch()
        finally:
            self.config["url"] = original

    def parse(self, payload: FetchedPayload) -> list[dict[str, Any]]:
        parsed = json.loads(payload.content.decode("utf-8"))
        articles = parsed.get("articles", [])
        if not isinstance(articles, list):
            raise ValueError("GDELT response did not contain an article list")
        return [article for article in articles if isinstance(article, dict)]

    def normalize(self, rows: list[dict[str, Any]], payload: FetchedPayload) -> list[NewsEvent]:
        deduplicated: dict[str, NewsEvent] = {}
        for row in rows:
            title = re.sub(r"\s+", " ", str(row.get("title", ""))).strip()
            url = canonical_url(str(row.get("url", "")))
            if not title or not urlparse(url).netloc:
                continue
            combined = f"{title} {row.get('snippet', '')}".lower()
            companies = [name for name, tokens in COMPANY_RULES.items() if any(token in combined for token in tokens)]
            memory_types = [name for name, tokens in MEMORY_RULES.items() if any(token in combined for token in tokens)]
            tags = [name for name, tokens in TAG_RULES.items() if any(token in combined for token in tokens)]
            keyword_hits = min(len(memory_types) + len(companies) + len(tags), 8)
            relevance = round(min(1.0, 0.2 + keyword_hits * 0.1), 2)
            published = _published(str(row.get("seendate", "")), payload.retrieved_at)
            domain = urlparse(url).netloc.lower().removeprefix("www.")
            group_id = stable_id("news_group", re.sub(r"\W+", " ", title.lower()).strip())
            event = NewsEvent(
                event_id=stable_id(self.source_id, url, published.date()),
                published_at=published,
                collected_at=payload.retrieved_at,
                title=title[:300],
                source_domain=domain,
                source_name=str(row.get("domain", domain)),
                article_url=url,
                query_category=query_lane(combined),
                companies=companies,
                memory_types=memory_types,
                event_tags=tags,
                short_excerpt=re.sub(r"\s+", " ", str(row.get("snippet", ""))).strip()[:400],
                relevance_score=relevance,
                duplicate_group_id=group_id,
            )
            current = deduplicated.get(group_id)
            if current is None or event.relevance_score > current.relevance_score:
                deduplicated[group_id] = event
        return list(deduplicated.values())
