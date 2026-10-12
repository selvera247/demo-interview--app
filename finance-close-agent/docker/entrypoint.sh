#!/usr/bin/env bash
# Ensure synthetic SQLite exists, then start the requested service.
set -euo pipefail
cd /app

if [[ ! -f data/finance.db ]]; then
  echo "[entrypoint] generating data/finance.db …"
  python generate_data.py
else
  echo "[entrypoint] using existing data/finance.db"
fi

role="${1:-api}"
case "$role" in
  api)
    exec uvicorn api.main:app --host 0.0.0.0 --port 8000
    ;;
  streamlit|ui)
    exec streamlit run ui/review_app.py \
      --server.address 0.0.0.0 \
      --server.port 8501 \
      --server.headless true
    ;;
  workflow)
    # One-shot close pass (useful for smoke / CI)
    exec python agent/close_agent.py
    ;;
  *)
    exec "$@"
    ;;
esac
