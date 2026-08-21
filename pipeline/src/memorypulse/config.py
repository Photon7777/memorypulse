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


def source_policy(root: Path | None = None) -> dict[str, Any]:
    return load_yaml("sources.yml", root).get("policy", {})


def device_watchlist(root: Path | None = None) -> dict[str, Any]:
    return load_yaml("device_watchlist.yml", root)


def free_only_enabled(root: Path | None = None) -> bool:
    configured = bool(source_policy(root).get("free_only_default", True))
    value = os.getenv("MEMORYPULSE_FREE_ONLY")
    if value is None:
        return configured
    return value.strip().lower() not in {"0", "false", "no", "off"}


def source_allowed_in_free_mode(config: dict[str, Any]) -> bool:
    return bool(config.get("eligible_for_public_pipeline", True)) and str(
        config.get("cost_tier", "free")
    ) in {"free", "free_with_key"}


def indicator_config(root: Path | None = None) -> dict[str, Any]:
    return load_yaml("indicators.yml", root)


def user_agent() -> str:
    return os.getenv(
        "MEMORYPULSE_USER_AGENT",
        "MemoryPulse/1.0 (+https://github.com/Photon7777/memorypulse; public research project)",
    )


def http_timeout() -> float:
    return float(os.getenv("MEMORYPULSE_HTTP_TIMEOUT", "30"))
