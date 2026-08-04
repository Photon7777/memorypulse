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

"${PYTHON_BIN}" -m memorypulse.cli update "$@"
"${PYTHON_BIN}" -m memorypulse.cli validate
