#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON:-python3}"
"${PYTHON_BIN}" -m pip install -e ".[dev]"
(cd frontend && npm ci)
"${PYTHON_BIN}" -m memorypulse.cli export --production
