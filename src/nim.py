"""NVIDIA NIM client helpers. No GPU required — weights stay on NVIDIA's cloud."""

from __future__ import annotations

import os
from typing import Any

import httpx

DEFAULT_NOOA_MODEL = "nvidia_nim/nvidia/nemotron-3.5-lightning-30b-a3b"
DEFAULT_NIM_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b"
DEFAULT_NIM_BASE = "https://integrate.api.nvidia.com/v1"


def nvidia_api_key() -> str:
    return os.getenv("NVIDIA_API_KEY", "").strip()


def nooa_model() -> str:
    return os.getenv("NOOA_MODEL", DEFAULT_NOOA_MODEL).strip() or DEFAULT_NOOA_MODEL


def nim_model_id() -> str:
    return os.getenv("NIM_MODEL_ID", DEFAULT_NIM_MODEL).strip() or DEFAULT_NIM_MODEL


def nim_base_url() -> str:
    return os.getenv("NIM_BASE_URL", DEFAULT_NIM_BASE).rstrip("/")


def make_llm(model: str | None = None):
    """Return a NOOA UnifiedLLM pointed at hosted Nemotron NIM."""
    from nooa.unifiedllm.registry import get_llm_client

    key = nvidia_api_key()
    if not key:
        raise RuntimeError("NVIDIA_API_KEY is not set")
    name = (model or nooa_model()).strip()
    return get_llm_client(name, api_key=key)


async def ping_nim(timeout: float = 45.0) -> dict[str, Any]:
    """Tiny chat completion against hosted NIM. Used by /api/health."""
    key = nvidia_api_key()
    if not key:
        return {"ok": False, "error": "NVIDIA_API_KEY is not set"}
    url = f"{nim_base_url()}/chat/completions"
    payload = {
        "model": nim_model_id(),
        "messages": [{"role": "user", "content": "Reply with the single word pong."}],
        "max_tokens": 8,
        "temperature": 0,
        "stream": False,
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json=payload,
            )
        text = r.text
        if r.status_code >= 400:
            return {
                "ok": False,
                "status": r.status_code,
                "error": text[:800],
                "model": nim_model_id(),
            }
        data = r.json()
        choice = (data.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        content = (message.get("content") or "").strip()
        usage = data.get("usage") or {}
        return {
            "ok": True,
            "model": data.get("model") or nim_model_id(),
            "content": content[:200],
            "usage": usage,
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc), "model": nim_model_id()}
