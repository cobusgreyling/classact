#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
  # shellcheck disable=SC1091
  source .venv/bin/activate
  pip install -U pip
  pip install -r requirements.txt
else
  # shellcheck disable=SC1091
  source .venv/bin/activate
  pip install -q -r requirements.txt
fi

if [[ ! -f .env ]]; then
  echo "No .env found. Copy .env.example to .env and set NVIDIA_API_KEY."
  echo "Inspect and Build still work without a key; Run needs NIM."
fi

exec python app.py
