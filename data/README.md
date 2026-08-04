# Data storage

`history/` is the canonical, append-only-after-deduplication store. Numerical observations use
CSV; news metadata uses NDJSON. `exports/` is reserved for optional analytical Parquet output.
Ephemeral DuckDB databases and offline fixture output live under ignored `build/` paths.

No raw HTML, complete article text, secrets, or fixture data intended for production belongs here.
