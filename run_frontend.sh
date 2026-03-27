#!/usr/bin/env bash
# Installs dependencies (first run) and starts the Next.js dev server
set -e

cd "$(dirname "$0")/frontend"

if [ ! -d "node_modules" ]; then
  echo "[Frontend] Installing dependencies..."
  npm install
fi

echo "[Frontend] Starting on http://localhost:3000"
npm run dev
