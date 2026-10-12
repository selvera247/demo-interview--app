"""Anthropic Messages API adapter."""

from __future__ import annotations

import json
import os
from typing import Any

from llm import LLMError, LLMProvider


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self, config: dict[str, Any]):
        self.config = config
        self.model = config.get("model")
        if not self.model:
            raise LLMError("provider anthropic: 'model' required in config/llm.yaml")
        key_env = config.get("api_key_env") or "ANTHROPIC_API_KEY"
        self.api_key = os.environ.get(key_env, "")
        if not self.api_key:
            raise LLMError(f"provider anthropic: set env var {key_env}")
        self.temperature = float(config.get("temperature", 0))
        self.timeout = float(config.get("timeout", 60))

    def generate(
        self,
        system: str,
        user: str,
        json_schema: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        try:
            import anthropic
        except ImportError as exc:
            raise LLMError("anthropic package not installed") from exc

        client = anthropic.Anthropic(api_key=self.api_key, timeout=self.timeout)
        resp = client.messages.create(
            model=self.model,
            max_tokens=1024,
            temperature=self.temperature,
            system=system
            + "\nRespond with a single JSON object only, no markdown fences.",
            messages=[{"role": "user", "content": user}],
        )
        content = ""
        for block in resp.content:
            if getattr(block, "type", None) == "text":
                content += block.text
        content = content.strip()
        if content.startswith("```"):
            content = content.strip("`")
            if content.startswith("json"):
                content = content[4:].strip()
        usage = None
        if getattr(resp, "usage", None) is not None:
            usage = {
                "prompt_tokens": getattr(resp.usage, "input_tokens", None),
                "completion_tokens": getattr(resp.usage, "output_tokens", None),
                "total_tokens": None,
            }
            if usage["prompt_tokens"] is not None and usage["completion_tokens"] is not None:
                usage["total_tokens"] = usage["prompt_tokens"] + usage["completion_tokens"]
        try:
            data = json.loads(content)
        except json.JSONDecodeError as exc:
            raise LLMError(f"invalid JSON from anthropic: {exc}") from exc
        if not isinstance(data, dict):
            raise LLMError("anthropic JSON root must be an object")
        data["_usage"] = usage
        data["_raw"] = content
        return data
