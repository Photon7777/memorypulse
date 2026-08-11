# MemoryPulse methodology

Version: **1.3.0**

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

Official macro series remain independent because producer prices, computer/electronics production,
consumer computer prices, employment, and export dollars are
not compatible units. Only the configured FRED semiconductor producer-price series contributes to the
macro-pressure component. BLS employment and World Bank exports are displayed as separate business
context signals with their own changes, dates, and units.

The market-trend momentum matrix calculates 1-, 3-, 6-, and 12-observation percentage changes when
enough comparable history exists. It displays one representative series per memory generation and
horizon, preferring a generation-level series name and otherwise selecting the series with the most
observations. The underlying series ID is exposed in the tooltip; incompatible series are not averaged.
The Pressure Index history chart plots stored index vintages and their represented-weight confidence,
so a score change can be distinguished from a coverage change.

## Memory Pressure Index

Configured version 1.3 weights are:

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

## Short-horizon forecast selection and backtesting

Forecasting requires at least 12 genuine observations at a consistent frequency. Ten candidates compete:
naive last value, drift, three-observation rolling mean, seasonal naive, damped Holt trend, additive
damped ETS, Theta, autoregression, ARIMA(1,1,1), and a robust ensemble. Candidate-specific minimum
history rules prevent advanced models from fitting unsuitable short samples. A separate rolling-origin
evaluation is run for the requested 1-, 3-, and 6-month horizon, so a model selected for one month is not
automatically treated as the best six-month model. Each target is predicted using only earlier data.

- `MAE = mean(|actual − forecast|)` is the primary comparable error.
- `sMAPE` and `MASE` provide scale-aware diagnostics; MAPE is retained only when actual values are nonzero.
- Directional accuracy records whether each predicted move had the same sign as the observed move.
- Stability is the share of eligible rolling windows that fit successfully.
- The naive model is always evaluated.
- A complex candidate must beat naive MAE by at least 2% and achieve at least 75% stability; otherwise
  the simpler baseline remains selected.
- A 95% interval uses the empirical absolute-residual quantile, a scale floor, and square-root horizon
  expansion, with the lower bound floored at zero.

Forecast rows preserve model/version, training dates, observations used, metrics, target date, and
creation vintage. Forecasts are recalculated at most weekly unless manually forced. The accuracy view
joins matured forecast targets to subsequently observed compatible values.

### Structural scenarios versus industry outlooks

The 1-, 3-, and 6-month curves are series-specific statistical forecasts. A flat naive midpoint means
that no eligible trend model beat the last-value baseline on unseen windows for that exact public
series. It does not represent analyst consensus for the whole DRAM market.

The separate 12-, 18-, and 24-month DDR5 structural model combines 45% clipped observed momentum,
20% official semiconductor producer-price momentum, and 35% attributed directional research. The
observed and macro inputs are capped, the second year is damped, and the output includes easing, base,
and tight-supply cases. It is labeled low confidence while fewer than 36 monthly DDR5 observations are
available. These are transparent market-informed scenarios, not claims of backtested multi-year accuracy.

Longer-horizon external industry outlooks are also stored separately with publisher, publication date, horizon,
segment, metric, direction, source URL, and numeric ranges only when the publisher supplied them.
MemoryPulse never converts a qualitative view into an invented percentage or applies a combined
DRAM-and-SSD estimate directly to DDR5 $/GB. The interface juxtaposes these evidence layers while
preserving their different definitions.

## Business conclusion and ML readiness

Every validated run generates a deterministic executive brief from the versioned index, its component
coverage, the latest comparable DDR5 movement, the latest eligible rolling-backtest forecast, and the
24-month structural base case when available. The
rules classify the market as Watch, Stable, Tightening, Easing, or High pressure; state direction and
confidence; and map those signals to procurement, inventory, and budget-risk postures. When less than
35% of configured index weight is represented, the regime is always Watch and the conclusion explicitly
avoids a change in business policy pending confirmation.

Driver contributions are the component score multiplied by its normalized effective weight. Missing
signals and forecast uncertainty are listed as risks. This is explainable rules-based decision support,
not an LLM-generated recommendation. The current brief and its compact history are exported and stored
with methodology version 1.3.

Baseline forecasting becomes eligible at 12 comparable observations. Fully learned multivariate or
boosted models remain gated until at least 48 comparable monthly DDR5 observations exist. Until then,
the long-range model uses disclosed weights and scenario assumptions, and the Analytics page reports the
exact point count rather than labeling a small sample as ML-ready.

The procurement lab is a scenario calculation: purchase-now cost plus proportional annual carrying cost
is compared with a wait cost after an explicit expected price move. It does not model supplier terms,
lead-time risk, taxes, financing constraints, or negotiated prices and is not purchasing advice.

## Public dataset release

After successful validation, the pipeline materializes the canonical public tables as CSV or NDJSON and
equivalent Zstandard Parquet. It derives JSON Schemas from the ephemeral DuckDB contracts, publishes row
counts, date coverage, source IDs, byte sizes, and SHA-256 hashes in `catalog.json`, and bundles the same
artifacts in a versioned ZIP. The release includes forecasts, index vintages, conclusion history, and
source-run health, official electronics price milestones, structural forecasts, and explicit device exposure assumptions so
downstream users can reproduce both analytical results and their evidence state.
No raw HTML, article bodies, API keys, or permission-gated DRAMeXchange observations are distributed.
Third-party source rights remain separate from the repository's MIT code license.

## Causal-language limits

The conceptual pathway from AI infrastructure demand through HBM/server prioritization and manufacturing
allocation to conventional DRAM constraints and consumer price implications is a market mechanism to
investigate. MemoryPulse uses phrases such as “associated with,” “coincided with,” “may reflect,” and
“market context.” It does not claim that observational timing proves AI demand caused a specific price,
shortage, or company decision.
