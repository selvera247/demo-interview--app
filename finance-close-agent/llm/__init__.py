"""LLM provider interface and factory."""

from __future__ import annotations

import os
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / "config" / "llm.yaml"

# Load .env if present (never required).
load_dotenv(ROOT / ".env", override=False)


class LLMError(Exception):
    """Provider or parsing failure."""


class LLMProvider(ABC):
    name: str = "base"

    @abstractmethod
    def generate(
        self,
        system: str,
        user: str,
        json_schema: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Return a dict matching json_schema fields. Raises LLMError on failure."""


def load_llm_config(path: Path | None = None) -> dict[str, Any]:
    cfg_path = path or Path(os.environ.get("LLM_CONFIG", DEFAULT_CONFIG))
    raw = yaml.safe_load(cfg_path.read_text(encoding="utf-8")) or {}
    providers = raw.get("providers") or {}
    default = raw.get("default_provider") or "heuristic"
    # Env override
    default = os.environ.get("LLM_PROVIDER", default)
    return {
        "default_provider": default,
        "providers": providers,
        "temperature": float(raw.get("temperature", 0)),
        "timeout": float(raw.get("timeout", 60)),
    }


def get_provider(
    name: str | None = None,
    config_path: Path | None = None,
) -> LLMProvider:
    cfg = load_llm_config(config_path)
    provider_name = (name or cfg["default_provider"]).strip().lower()
    blocks = cfg["providers"]
    if provider_name not in blocks:
        raise LLMError(
            f"Unknown provider {provider_name!r}; "
            f"known: {sorted(blocks)}"
        )
    block = dict(blocks[provider_name] or {})
    block.setdefault("temperature", cfg["temperature"])
    block.setdefault("timeout", cfg["timeout"])

    if provider_name == "heuristic":
        from llm.heuristic import HeuristicProvider

        return HeuristicProvider(block)
    if provider_name == "anthropic":
        from llm.anthropic_provider import AnthropicProvider

        return AnthropicProvider(block)
    # OpenAI-compatible (openai, xai, deepseek, ollama, …)
    from llm.openai_compatible import OpenAICompatibleProvider

    return OpenAICompatibleProvider(provider_name, block)
