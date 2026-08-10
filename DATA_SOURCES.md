# MemoryPulse data sources

All production adapters identify MemoryPulse as a public research project, use timeouts and limited
retries, respect source-specific limits, and fail independently. Normalized records retain the source
URL and UTC collection time. The repository does not contain downloaded HTML or article bodies.

Eligible normalized records are also packaged under `frontend/public/datasets/latest/` as canonical
text, Parquet, schemas, checksums, and a ZIP. Distribution never overrides upstream rights: users must
review [DATA_LICENSE.md](DATA_LICENSE.md) and the source-specific notes below before redistribution.

## Official electronics price milestones

- **Sources:** Official U.S. announcements and product pages from PlayStation, Xbox, Nintendo, and Apple.
- **Collected:** Announcement date, manufacturer, product family, configuration, U.S. starting price,
  memory/storage when explicitly stated, source URL, notes, and a comparability label.
- **Frequency:** Curated when an official manufacturer announces a material launch or price revision.
- **Authentication:** None.
- **Reliability:** First-party manufacturer statements for the stated price and configuration.
- **Caveats:** A starting price is not a quality-adjusted price index. Console same-family paths are
  generally more comparable; MacBook entry tiers change memory, storage, processors, and capability.
  The table therefore labels observations as like-for-like, same-family, or starting-tier comparisons.
- **Redistribution:** MemoryPulse distributes normalized factual milestones and source links, not copies
  of announcement pages or product photography. Manufacturer terms and marks remain their owners'.
- **Failure behavior:** This curated table is independent of scheduled network collection. Contract and
  date validation must pass before it enters the public bundle.

## Stanford Memory Price Data

- **URL:** <https://dam.stanford.edu/assets/memory-prices/memory-prices.csv>
- **Collected:** Date, category, series, metric, value, unit, underlying source attribution, sample
  count, representative description, and notes.
- **Frequency:** Checked daily; used primarily as historical/monthly context.
- **Authentication:** None.
- **Reliability:** Research dataset assembled from multiple attributed underlying sources.
- **Caveats:** Series definitions vary. Values are not automatically combined. Estimated values,
  including HBM context where identified, remain `is_estimate: true` and are not relabeled as public
  spot transactions. Source revisions can alter historical rows.
- **Redistribution:** Only normalized observations and attribution are committed; users should review
  Stanford and each named underlying source’s terms before redistributing data elsewhere.
- **Failure behavior:** A schema mismatch, network error, or zero valid rows marks the adapter
  degraded. Individual invalid/future rows are rejected and counted without discarding valid rows.

## DRAMeXchange public homepage

- **URL:** <https://www.dramexchange.com/>
- **Collected:** When explicitly enabled, only numerical rows visible in current public spot/module
  homepage tables, their labels, homepage URL, and collection time.
- **Frequency:** At most once per pipeline run and no more than the daily scheduled run.
- **Authentication:** None; member, login, paid-history, and bypass paths are prohibited.
- **Reliability:** Public homepage snapshot; layout and availability can change without notice.
- **Caveats:** The public `robots.txt` endpoint returned a 404-style page. The current Terms of Use were
  reviewed on August 4, 2026 and restrict reproduction or distribution of site materials without prior
  written consent, so automatic collection remains disabled unless that permission is obtained.
- **Redistribution:** Normalized numerical facts only. Full HTML is never committed.
- **Failure behavior:** This source is reported as permission-gated, not failed. If written permission is
  obtained and collection is explicitly enabled, blocked access, a layout mismatch, more than 100 parsed
  rows, or zero rows marks the source degraded while previous data remains intact.

## FRED semiconductor indicator

- **URL:** <https://fred.stlouisfed.org/graph/fredgraph.csv?id=PCU3344133441>
- **Series:** `PCU3344133441`, Producer Price Index by Industry: Semiconductor and Related Device
  Manufacturing.
- **Collected:** Observation date, series identifier/name, numeric value, unit, URL, and UTC collection
  time. Missing `.`/blank values are excluded.
- **Frequency:** Checked daily; the underlying series is generally monthly.
- **Authentication:** None for the public graph CSV endpoint.
- **Reliability:** Official-statistics context from FRED and its source agency.
- **Caveats:** This is a broad semiconductor producer-price index, not a RAM price and not a direct
  measure of consumer module cost.
- **Redistribution:** Normalized values and source attribution are retained; FRED/source notes apply.
- **Failure behavior:** The source degrades independently; price and news collection can continue.

## BLS semiconductor employment

- **URL:** <https://api.bls.gov/publicAPI/v1/timeseries/data/CES3133441301>
- **Series:** `CES3133441301`, U.S. semiconductor and related device manufacturing employment.
- **Collected:** Monthly observation date, employment in thousands, series identifier/name, source URL,
  and UTC collection time. The annual-average `M13` record is excluded.
- **Frequency:** Checked daily; the underlying series is monthly.
- **Authentication:** None through the BLS v1 Public Data API.
- **Reliability:** Official U.S. labor statistics.
- **Caveats:** Employment is a capacity/labor context signal, not a memory price and not a direct measure
  of output. It is displayed separately and is not averaged with incompatible macro units.
- **Failure behavior:** API status errors, malformed records, or zero valid rows degrade only this source.

## World Bank high-technology exports

- **URL:** <https://api.worldbank.org/v2/country/WLD/indicator/TX.VAL.TECH.CD?format=json&per_page=100>
- **Series:** `TX.VAL.TECH.CD`, global high-technology exports in current U.S. dollars.
- **Collected:** Annual observation date, value, series metadata, source URL, and UTC collection time.
- **Frequency:** Checked daily; the underlying indicator is annual and may be revised.
- **Authentication:** None.
- **Reliability:** Official World Bank indicator API.
- **Caveats:** The category is much broader than memory or semiconductors, uses nominal dollars, and is
  retained as business context only. It is never combined numerically with price or employment units.
- **Failure behavior:** API errors, empty responses, and invalid dates degrade only this source.

## Federal Register semiconductor policy metadata

- **URL:** <https://www.federalregister.gov/api/v1/documents.json?per_page=50&order=newest&conditions%5Bterm%5D=semiconductor>
- **Collected:** Official document title, publication timestamp, canonical HTML URL, agency names,
  abstract excerpt, and transparent policy tags. No full document body is retained.
- **Frequency:** Once per daily run with a bounded 50-document response.
- **Authentication:** None.
- **Reliability:** Official U.S. government rule and notice metadata.
- **Caveats:** A keyword match does not imply a market impact. Policy records support traceability and
  event context; they do not establish causality or automatically change a procurement posture.
- **Failure behavior:** Errors or empty results degrade independently and preserve earlier metadata.

## Evaluated but not enabled

- **SEC EDGAR:** The API is free, but automated clients must declare a responsible organization and
  contact email in the User-Agent. MemoryPulse does not invent or expose the repository owner's email,
  so EDGAR is not enabled until the owner explicitly supplies an approved contact identity.
- **U.S. Census international trade:** The current API documentation requires an API key for all
  international-trade queries. It remains a future optional integration rather than a keyless core feed.

## GDELT DOC API

- **URL:** <https://api.gdeltproject.org/api/v2/doc/doc>
- **Collected:** Article title, publisher/domain, canonical source URL, published/seen time, short API
  excerpt when supplied, memory/company keyword matches, explainable event tags, relevance score,
  and deduplication group. No full article text.
- **Frequency:** Once during the daily run, querying the preceding day with a bounded result count.
- **Authentication:** None.
- **Reliability:** Aggregated news metadata; source coverage and timestamps vary.
- **Caveats:** Syndication can create duplicates. Keyword relevance is transparent but imperfect.
  Coverage intensity is not proof that an event occurred as described and does not establish causality.
- **Redistribution:** Only metadata and short excerpts are retained for about 365 days; publisher
  content remains at the linked source.
- **Failure behavior:** A rate limit (including HTTP 429) is not retried during the same run. A concise,
  query-free reason is disclosed as degraded, the next scheduled update retries once, and previously
  validated metadata remains available. Other API errors, malformed JSON, and zero rows also remain
  isolated from core price collection.

## Optional Best Buy Products API

- **URL:** <https://api.bestbuy.com/v1/products>
- **Collected:** SKU, manufacturer, product name, current/regular prices, availability, product URL,
  parsed generation/capacity/module count/speed, price per GB, and parsing confidence.
- **Frequency:** At most once during the daily run when configured.
- **Authentication:** `BESTBUY_API_KEY`; optional and server-side only.
- **Reliability:** Optional official retail API.
- **Caveats:** API availability, pricing, quotas, and free access are not guaranteed. Products with low
  parsing confidence remain visible in normalized output but are excluded from generation aggregates.
- **Redistribution:** Normalized product facts and links only, subject to current API terms.
- **Failure behavior:** Without a key it is explicitly `disabled`, not failed. With a key, errors are
  isolated and lower index confidence rather than stopping the core pipeline.
