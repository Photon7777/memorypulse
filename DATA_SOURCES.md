# MemoryPulse data sources

All production adapters identify MemoryPulse as a public research project, use timeouts and limited
retries, respect source-specific limits, and fail independently. Normalized records retain the source
URL and UTC collection time. The repository does not contain downloaded HTML or article bodies.

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
- **Caveats:** `robots.txt` returned a 404-style page during development, so automatic collection is
  disabled by default pending repository-owner review of current robots and applicable terms.
- **Redistribution:** Normalized numerical facts only. Full HTML is never committed.
- **Failure behavior:** Blocked access, a layout mismatch, more than 100 parsed rows, or zero rows marks
  the source degraded while previous data remains intact.

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
- **Failure behavior:** Rate limits (including HTTP 429), API errors, malformed JSON, and zero rows are
  disclosed as degraded and never fail core price collection.

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
