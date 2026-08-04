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

## Remaining

- [ ] Repository owner: replace GitHub `OWNER` placeholders, push to a public GitHub repository, and select
  **Settings → Pages → Build and deployment → Source → GitHub Actions**.
- [ ] Repository owner: review current DRAMeXchange robots/terms before enabling that adapter.
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

- Public endpoints may revise schemas/history or enforce rate limits; GDELT returned HTTP 429 on a repeat
  development request after a successful collection.
- DRAMeXchange collection remains disabled because its robots endpoint returned a 404-style page during
  development and owner review is required before production access.
- Best Buy data is absent without the optional key, reducing retail component confidence by design.
- FRED is broad semiconductor context, not a direct RAM price; Stanford series definitions vary.
- Public news intensity and conceptual allocation mechanisms are associations, not causal proof.
- The GitHub Actions workflows and Pages deployment are locally syntax/build prepared but cannot be executed
  until the repository is pushed and the Pages source is selected in GitHub.
