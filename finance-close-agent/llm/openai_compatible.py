"""OpenAI-compatible chat completions (OpenAI, xAI, DeepSeek, Ollama, …)."""

from __future__ import annotations

import json
import os
from typing import Any

from llm import LLMError, LLMProvider


class OpenAICompatibleProvider(LLMProvider):
    def __init__(self, name: str, config: dict[str, Any]):
        self.name = name
        self.config = config
        self.model = config.get("model")
        if not self.model:
            raise LLMError(f"provider {name}: 'model' required in config/llm.yaml")
        self.base_url = config.get("base_url") or "https://api.openai.com/v1"
        key_env = config.get("api_key_env") or "OPENAI_API_KEY"
        self.api_key = os.environ.get(key_env, "")
        # Ollama often needs no key
        if not self.api_key and name != "ollama":
            raise LLMError(
                f"provider {name}: set env var {key_env} (see .env.example)"
            )
        self.temperature = float(config.get("temperature", 0))
        self.timeout = float(config.get("timeout", 60))

    def generate(
        self,
        system: str,
        user: str,
        json_schema: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise LLMError("openai package not installed") from exc

        client = OpenAI(
            api_key=self.api_key or "ollama",
            base_url=self.base_url,
            timeout=self.timeout,
        )
        kwargs: dict[str, Any] = {
            "model": self.model,
            "temperature": self.temperature,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        # Prefer JSON object mode when supported
        try:
            kwargs["response_format"] = {"type": "json_object"}
            resp = client.chat.completions.create(**kwargs)
        except Exception:
            kwargs.pop("response_format", None)
            resp = client.chat.completions.create(**kwargs)

        content = (resp.choices[0].message.content or "").strip()
        usage = None
        if getattr(resp, "usage", None) is not None:
            usage = {
                "prompt_tokens": getattr(resp.usage, "prompt_tokens", None),
                "completion_tokens": getattr(resp.usage, "completion_tokens", None),
                "total_tokens": getattr(resp.usage, "total_tokens", None),
            }
        try:
            data = json.loads(content)
        except json.JSONDecodeError as exc:
            raise LLMError(f"invalid JSON from {self.name}: {exc}") from exc
        if not isinstance(data, dict):
            raise LLMError(f"{self.name} JSON root must be an object")
        data["_usage"] = usage
        data["_raw"] = content
        return data
