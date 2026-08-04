from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml


def repository_root() -> Path:
    return Path(__file__).resolve().parents[3]


def load_yaml(name: str, root: Path | None = None) -> dict[str, Any]:
    path = (root or repository_root()) / "config" / name
    with path.open(encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def source_config(root: Path | None = None) -> dict[str, dict[str, Any]]:
    return load_yaml("sources.yml", root).get("sources", {})


def indicator_config(root: Path | None = None) -> dict[str, Any]:
    return load_yaml("indicators.yml", root)


def user_agent() -> str:
    return os.getenv(
        "MEMORYPULSE_USER_AGENT",
        "MemoryPulse/1.0 (+https://github.com/Photon7777/memorypulse; public research project)",
    )


def http_timeout() -> float:
    return float(os.getenv("MEMORYPULSE_HTTP_TIMEOUT", "30"))
