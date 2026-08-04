# Data storage

`history/` is the canonical, append-only-after-deduplication store. Numerical observations use
CSV; news metadata uses NDJSON. `exports/` is reserved for optional analytical Parquet output.
Ephemeral DuckDB databases and offline fixture output live under ignored `build/` paths.

`history/decision_briefs.csv` is the compact audit trail for the conclusion produced by each successful
run. It stores the methodology version, regime, direction, confidence, pressure score, business posture,
and conclusion; detailed drivers and risks remain in the latest generated frontend JSON.

No raw HTML, complete article text, secrets, or fixture data intended for production belongs here.
