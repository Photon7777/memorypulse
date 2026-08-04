#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_ROOT}"
if [[ -n "${PYTHON:-}" ]]; then
  PYTHON_BIN="${PYTHON}"
elif [[ -x "${PROJECT_ROOT}/.venv/bin/python" ]]; then
  PYTHON_BIN="${PROJECT_ROOT}/.venv/bin/python"
else
  PYTHON_BIN="python3"
fi
export PYTHONPATH="${PROJECT_ROOT}/pipeline/src${PYTHONPATH:+:${PYTHONPATH}}"

"${PYTHON_BIN}" -m ruff check pipeline
"${PYTHON_BIN}" -m pytest
"${PYTHON_BIN}" -m memorypulse.cli update --offline --output-root build/offline
"${PYTHON_BIN}" -m memorypulse.cli validate --root build/offline
"${PYTHON_BIN}" -m memorypulse.cli check-size
(cd frontend && npm run lint && npm run typecheck && npm run test:run && npm run build)
