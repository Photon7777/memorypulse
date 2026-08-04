from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any

from memorypulse.models import NewsEvent, stable_id
from memorypulse.sources.base import FetchedPayload, SourceAdapter

MEMORY_TERMS = {
    "DDR4": ("ddr4",),
    "DDR5": ("ddr5",),
    "HBM": ("hbm", "high bandwidth memory"),
    "DRAM": ("dram", "memory chip"),
}
POLICY_TERMS = {
    "export controls": ("export control", "entity list", "export administration regulations"),
    "public funding": ("chips act", "funding", "award", "incentive"),
    "trade policy": ("tariff", "trade", "import", "export"),
    "semiconductor policy": ("semiconductor", "integrated circuit"),
}


class FederalRegisterSemiconductorSource(SourceAdapter[NewsEvent]):
    source_id = "federal_register_semiconductor"
    source_name = "Federal Register semiconductor policy"
    max_attempts = 2

    def parse(self, payload: FetchedPayload) -> list[dict[str, Any]]:
        document = json.loads(payload.content.decode("utf-8"))
        results = document.get("results", [])
        if not isinstance(results, list):
            raise ValueError("Federal Register response did not contain results")
        return [item for item in results if isinstance(item, dict)]

    def normalize(self, rows: list[dict[str, Any]], payload: FetchedPayload) -> list[NewsEvent]:
        output = []
        for row in rows:
            title = re.sub(r"\s+", " ", str(row.get("title", ""))).strip()
            article_url = str(row.get("html_url", "")).strip()
            document_number = str(row.get("document_number", "")).strip()
            if not title or not article_url or not document_number:
                continue
            try:
                published = datetime.fromisoformat(str(row["publication_date"])).replace(tzinfo=timezone.utc)
            except (KeyError, ValueError):
                continue
            abstract = re.sub(r"\s+", " ", str(row.get("abstract", ""))).strip()
            combined = f"{title} {abstract}".lower()
            memory_types = [name for name, terms in MEMORY_TERMS.items() if any(term in combined for term in terms)]
            tags = [name for name, terms in POLICY_TERMS.items() if any(term in combined for term in terms)]
            if "semiconductor policy" not in tags:
                tags.append("semiconductor policy")
            agencies = row.get("agencies", [])
            agency_names = [str(item.get("name", "")) for item in agencies if isinstance(item, dict) and item.get("name")]
            source_name = ", ".join(agency_names[:2]) or "Federal Register"
            output.append(
                NewsEvent(
                    event_id=stable_id(self.source_id, document_number),
                    published_at=published,
                    collected_at=payload.retrieved_at,
                    title=title[:300],
                    source_domain="federalregister.gov",
                    source_name=source_name,
                    article_url=article_url,
                    query_category="semiconductor_policy",
                    companies=[],
                    memory_types=memory_types,
                    event_tags=tags,
                    short_excerpt=abstract[:400],
                    relevance_score=round(min(1.0, 0.55 + 0.1 * len(memory_types) + 0.05 * len(tags)), 2),
                    duplicate_group_id=stable_id("policy_group", document_number),
                    manually_important=True,
                )
            )
        return output
