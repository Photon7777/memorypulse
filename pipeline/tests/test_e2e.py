from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest
from memorypulse.cli import run_update


def test_offline_pipeline_and_react_build(tmp_path) -> None:
    root = Path(__file__).resolve().parents[2]
    run_update(offline=True, output_root=tmp_path / "offline", force_forecast=True)
    manifest_path = tmp_path / "offline/frontend/public/data/manifest.json"
    manifest = json.loads(manifest_path.read_text())
    assert manifest["production_data"] is False
    assert (tmp_path / "offline/data/exports/quality-report.json").exists()
    if not shutil.which("npm") or not (root / "frontend/node_modules").exists():
        pytest.skip("frontend dependencies are not installed")
    subprocess.run(["npm", "run", "build"], cwd=root / "frontend", check=True)
