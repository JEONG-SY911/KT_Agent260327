#!/usr/bin/env bash
# Starts the Market Intelligence Analysis API (FastAPI + LangGraph)
set -e

cd "$(dirname "$0")"

echo "[Backend] Starting on http://localhost:8000"
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
