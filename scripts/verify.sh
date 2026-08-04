#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON:-python3}"
"${PYTHON_BIN}" -m ruff check pipeline
"${PYTHON_BIN}" -m pytest
"${PYTHON_BIN}" -m memorypulse.cli update --offline --output-root build/offline
"${PYTHON_BIN}" -m memorypulse.cli validate --root build/offline
"${PYTHON_BIN}" -m memorypulse.cli check-size
(cd frontend && npm run lint && npm run typecheck && npm run test:run && npm run build)
