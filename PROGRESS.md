# MemoryPulse progress

## Completed

- [x] Phase 1 — React/Vite and Python package scaffolding, strict toolchains, scripts, Make targets,
  environment example, ignore rules, MIT license, and local Git repository.
- [x] Phase 2 — typed contracts for prices, retail, macro, news, source runs, index observations, and
  forecasts; stable IDs; atomic, idempotent history writes; and equivalent ephemeral DuckDB tables.
- [x] Phase 3 — common resilient adapter framework plus Stanford, DRAMeXchange public-homepage, FRED,
  GDELT metadata, and optional Best Buy adapters; local lawful fixtures and non-publishable offline mode.
- [x] Phase 4 — canonical CSV/NDJSON history, deduplication, 365-day routine-news retention, DuckDB
  analytical views, quality report, outlier flags, and source-isolated failure handling.
- [x] Phase 5 — versioned 0–100 Memory Pressure Index with configured weights, robust normalization,
  component raw inputs/coverage, missing-weight rebalancing, confidence, status bands, and deterministic
  non-causal insights.
- [x] Phase 6 — minimum-history gate, naive/drift/rolling/Holt candidates, rolling-origin MAE/MAPE,
  model selection, residual intervals, weekly vintages, and forecast-accuracy view.
- [x] Phase 7 — polished responsive research site with overview, interactive price trends, conceptual AI
  context, event filters, forecasts, consumer impact explorer, methodology, and data-health sections.
- [x] Phase 8 — atomic, schema-checked static JSON contracts with strict finite values, deterministic
  sorting, manifest publication guard, and compact exports.
- [x] Phase 9 — separate CI, daily update, and GitHub Pages workflows with least-privilege permissions,
  concurrency, commit-on-change behavior, diagnostics, and repository-subpath-safe builds.
- [x] Phase 10 — complete README, data-source catalog, methodology, local/Windows setup, GitHub handoff,
  portfolio copy, limitations, license, and attribution.
- [x] Phase 11 — Python adapter/transformation/index/forecast/export tests, frontend utility tests, and an
  offline end-to-end test that rebuilds DuckDB, transforms, forecasts, exports, and builds React.
- [x] Phase 12 — no committed raw HTML/DuckDB/article bodies, bounded metadata retention, permanent compact
  numerical history, frontend size enforcement, ignored Parquet output, and documented archival method.
- [x] Live production path exercised successfully against Stanford and FRED; GDELT succeeded once and its
  later HTTP 429 was correctly recorded as degraded without losing earlier metadata.
- [x] Public repository created at `Photon7777/memorypulse`, `main` pushed, GitHub Pages configured for
  workflow deployment, and the initial CI/Pages runs executed successfully.
- [x] GitHub Actions upgraded to the current maintained major releases after GitHub reported Node.js 20
  runtime deprecation warnings on the initial workflow run.
- [x] Local verification hardened to prefer `.venv` and resolve the source-layout package even when a
  surrounding terminal exports an unrelated Python interpreter.
- [x] Added keyless official BLS employment, World Bank high-technology export, and Federal Register
  semiconductor-policy sources with isolated health reporting and lawful compact metadata storage.
- [x] Added a versioned executive decision brief on every successful run with posture, drivers, risks,
  conclusion history, separate official macro analytics, and explicit baseline/advanced-ML readiness.
- [x] Added 1/3/6-month forecast horizons, candidate-model comparisons, business-signal visualization,
  shareable/filterable price views, CSV exports, event search/sort, and a procurement decision lab.
- [x] Reorganized the site around Executive, Market analytics, Forecasts, Scenario lab, and Data; added
  focused analytical tabs, five downloadable chart types, mobile-responsive layouts, and LinkedIn-ready
  conclusion copy plus a generated insight-card download.
- [x] Added a public dataset release layer with CSV/NDJSON, Parquet, JSON Schemas, catalog metadata,
  SHA-256 checksums, a complete ZIP, source-specific reuse terms, daily regeneration, and monthly GitHub
  Release snapshots.

## Remaining

- [ ] Repository owner: obtain written DRAMeXchange permission before enabling or redistributing that adapter's data.
- [ ] Optional: add `BESTBUY_API_KEY` as a GitHub Actions repository secret for retail coverage.
- [ ] Optional: add deployment screenshots to the documented placeholders.

## Important design decisions

- Canonical history is compact CSV/NDJSON. Every DuckDB file is temporary and rebuilt from canonical data.
- Offline fixture runs write beneath ignored `build/` paths and must set `production_data: false`.
- Production publication requires at least one real core source and complete quality/export validation.
- Source failures are isolated; scheduled automation commits only after success, preserving the prior site.
- Gb and GB are never conflated. Original descriptions and explicit source price bases are preserved.
- Estimates stay labeled; incompatible series remain separate; no causal conclusion is inferred.
- Hash-based routing is implemented without an additional router dependency, avoiding repository-subpath
  failures and eliminating the router security advisories present during implementation.
- The site contains no generic hero imagery and uses typography, data, and CSS-native visual structure.

## Known limitations

- Public endpoints may revise schemas/history or enforce rate limits. GDELT uses one bounded attempt per
  daily run and preserves previously validated metadata when the API returns HTTP 429.
- DRAMeXchange collection remains disabled because its current Terms of Use restrict reproduction or
  distribution without prior written permission; its robots endpoint also returned a 404-style page.
- Best Buy data is absent without the optional key, reducing retail component confidence by design.
- FRED is broad semiconductor context, not a direct RAM price; Stanford series definitions vary.
- BLS employment and World Bank export dollars are contextual signals with incompatible units and are
  intentionally not blended into the FRED-based macro-pressure component.
- Advanced multivariate ML remains gated until 60 comparable monthly DDR5 observations are available;
  transparent rolling-backtest baselines are used in the meantime.
- Public news intensity and conceptual allocation mechanisms are associations, not causal proof.
- GitHub Pages deployment is active; future workflow behavior still depends on GitHub-hosted runner and
  upstream public-source availability.
