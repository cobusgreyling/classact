#!/usr/bin/env python3
"""Call a catalog agent without the studio.

ClassAct is the UI. NOOA is what you ship: copy the class, keep this call.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

DEFAULT_TEXT = "Great product, but shipping was slow."
DEFAULT_MODEL = "nvidia_nim/nvidia/nemotron-3.5-lightning-30b-a3b"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run ClassifierAgent.classify via NOOA + hosted NIM."
    )
    parser.add_argument("text", nargs="?", default=DEFAULT_TEXT)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the call shape and exit (no API key, no NIM).",
    )
    args = parser.parse_args()
    if args.dry_run:
        print("await ClassifierAgent(llm=llm).classify(text=...)")
        print(f"text: {args.text!r}")
        print("model:", os.getenv("NOOA_MODEL", DEFAULT_MODEL))
        return
    key = os.getenv("NVIDIA_API_KEY", "").strip()
    if not key:
        print(
            "Set NVIDIA_API_KEY in .env (https://build.nvidia.com) or the environment.",
            file=sys.stderr,
        )
        sys.exit(2)
    asyncio.run(_run(args.text, key))


async def _run(text: str, key: str) -> None:
    from catalog.classifier_agent import ClassifierAgent
    from nooa.unifiedllm.registry import get_llm_client

    model = os.getenv("NOOA_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    llm = get_llm_client(model, api_key=key)
    agent = ClassifierAgent(llm=llm)
    result = await agent.classify(text)
    print(result)


if __name__ == "__main__":
    main()
