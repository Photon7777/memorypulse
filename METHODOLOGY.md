# MemoryPulse methodology

Version: **1.0.0**

> MemoryPulse is an independent research project. Its Memory Pressure Index and forecasts are
> analytical estimates, not official industry benchmarks, investment advice, purchasing advice, or
> guarantees of future prices.

## Normalization and contracts

Every adapter separates fetch, parse, normalize, and validate steps. Machine timestamps are UTC.
Stable IDs use the source plus the smallest set of fields that identify an observation (for example,
observation date, source series/product, metric, and reported value) and a truncated SHA-256 digest.
This makes scheduled appends idempotent without relying on row order.

Polars reads and normalizes the Stanford CSV while preserving text fields and source attribution.
CSV is the canonical format for compact numerical time series; NDJSON is used for bounded news-event
metadata. DuckDB is rebuilt ephemerally from these files and creates reproducible analytical views.

## Gb versus GB

Capitalization is semantically important:

- **Gb** means gigabits, commonly chip density.
- **GB** means gigabytes, commonly module/device capacity.
- 1 byte equals 8 bits, but MemoryPulse does **not** automatically convert a `16Gb` chip label into a
  `16GB` module capacity because organization, module count, and source basis may be unknown.

The original description is always retained. A derived price per GB is calculated only as
`price ÷ explicit capacity in GB`. If a source explicitly reports `USD/GB`, that value may be stored as
price per GB without inventing a capacity. Ambiguous units produce `null`.

## Deduplication and atomic storage

Before each write, existing and candidate stable IDs are compared. Exact repeated IDs are rejected and
counted. New rows are deterministically sorted and written to a temporary sibling file, flushed, synced,
and atomically renamed. A failed write removes the temporary file and preserves the prior canonical file.
News URLs and normalized titles also create syndication groups; the highest-relevance event metadata is
kept per group in each collection response.

Routine news metadata older than about 365 days is pruned during news writes unless manually marked
important. Compact numerical price history is preserved indefinitely.

## Validation, outliers, and quality

- Prices must be finite and positive.
- Observation dates more than two days in the future are rejected and counted.
- Price per GB requires explicit GB capacity unless the source metric is explicitly per GB.
- Zero-row parses become degraded; they do not become successful empty updates.
- Public-homepage parsing is capped so a layout change cannot produce thousands of malformed rows.
- Sudden changes are identified with a robust median absolute deviation rule and/or traceable quality
  queries. They remain stored and source-linked; they are never silently removed.
- JSON uses strict finite values: NaN and Infinity cannot be serialized.
- The production manifest can never simultaneously claim fixture data.

The run writes `data/exports/quality-report.json`. Deployment and update automation stop before commit
when required validation fails.

## Analytical views and transformations

DuckDB exposes daily spot prices, monthly memory prices, retail generation summaries, price momentum,
rolling volatility, daily news counts, company event counts, macro changes, source freshness, forecast
accuracy, and index component views. Derived measures are calculated only on compatible definitions.
These include price per GB, 7/30/90-period changes where observations exist, monthly changes, rolling
averages/volatility, DDR4–DDR5 spreads, retail discounts, availability counts, news intensity, freshness,
coverage, and confidence.

## Memory Pressure Index

Configured version 1.0 weights are:

| Component | Weight | Raw input |
|---|---:|---|
| Spot-price momentum | 30% | Latest comparable public spot or price-series change |
| Retail-price momentum | 25% | Change in median high-confidence retail price per GB |
| Price volatility | 15% | Rolling standard deviation of compatible price observations |
| News pressure | 15% | Daily count of relevant, deduplicated metadata |
| Macro pressure | 15% | Period change in the configured semiconductor producer-price series |

Each component is reproducible from stored data and exports its raw inputs, transformation description,
and coverage. The current value is scaled using the trailing 10th and 90th percentiles:

`component_score = clamp(100 × (x − p10) ÷ (p90 − p10), 0, 100)`

When the baseline is constant, the score is 50. When fewer than three baseline values exist, the
component is unavailable rather than fabricated.

Available component scores are combined as:

`total = Σ(score_i × weight_i) ÷ Σ(available weight_i)`

`confidence = Σ(available weight_i) ÷ Σ(configured weight_i)`

Missing components are listed in deterministic insight text. Status labels are Normal (0–24), Moderate
Pressure (25–49), Elevated Pressure (50–74), and Severe Pressure (75–100). The index is analytical and
does not guarantee shortages or future prices.

## News relevance and event tags

No LLM is used. Case-insensitive keyword rules identify Samsung, SK hynix, Micron, DRAM, DDR4, DDR5,
HBM, and event categories such as supply expansion, production cut, capacity allocation, price increase,
price decline, HBM investment, factory construction, earnings guidance, shortage, and inventory.
Relevance starts from a documented base and increases with bounded company, memory, and event-rule hits.
The exported score is a triage aid, not a truth or sentiment score.

## Forecast selection and backtesting

Forecasting requires at least 12 genuine observations at a consistent frequency. Candidate one-step
models are naive last value, drift, three-observation rolling mean, and damped Holt trend. A rolling
origin begins after at least six training observations; every later observation is predicted using only
earlier data.

- `MAE = mean(|actual − forecast|)` drives model selection.
- `MAPE = mean(|actual − forecast| ÷ |actual|) × 100` is reported only when actual values are nonzero.
- The naive model is always evaluated.
- A 95% interval is `point forecast ± 1.96 × standard deviation(backtest residuals)`, floored at zero.

Forecast rows preserve model/version, training dates, observations used, metrics, target date, and
creation vintage. Forecasts are recalculated at most weekly unless manually forced. The accuracy view
joins matured forecast targets to subsequently observed compatible values.

## Causal-language limits

The conceptual pathway from AI infrastructure demand through HBM/server prioritization and manufacturing
allocation to conventional DRAM constraints and consumer price implications is a market mechanism to
investigate. MemoryPulse uses phrases such as “associated with,” “coincided with,” “may reflect,” and
“market context.” It does not claim that observational timing proves AI demand caused a specific price,
shortage, or company decision.
