#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

pyver="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
case "$pyver" in
  3.12|3.13) ;;
  *)
    echo "ClassAct needs Python 3.12 or 3.13 (NOOA does not support $pyver)."
    echo "Install 3.12+ and retry, or: uv python install 3.12"
    exit 1
    ;;
esac

if command -v uv >/dev/null 2>&1; then
  uv sync --extra dev
  if [[ ! -f .env ]]; then
    echo "No .env found. Copy .env.example to .env and set NVIDIA_API_KEY."
    echo "Inspect and Build still work without a key; Run needs NIM."
  fi
  exec uv run python app.py
fi

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
  # shellcheck disable=SC1091
  source .venv/bin/activate
  pip install -U pip
  pip install -e ".[dev]"
else
  # shellcheck disable=SC1091
  source .venv/bin/activate
  pip install -q -e ".[dev]"
fi

if [[ ! -f .env ]]; then
  echo "No .env found. Copy .env.example to .env and set NVIDIA_API_KEY."
  echo "Inspect and Build still work without a key; Run needs NIM."
fi

exec python app.py
