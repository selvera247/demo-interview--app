#!/usr/bin/env bash
# Smoke-test docker compose: health + close-pass flagged_count == 9
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if docker info >/dev/null 2>&1; then
  DOCKER=(docker)
elif sudo docker info >/dev/null 2>&1; then
  DOCKER=(sudo docker)
else
  echo "[verify] docker daemon not available" >&2
  exit 1
fi

echo "[verify] building and starting …"
"${DOCKER[@]}" compose up --build -d

cleanup() {
  "${DOCKER[@]}" compose down --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[verify] waiting for API health …"
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:8000/health/ready >/dev/null; then
    break
  fi
  sleep 2
  if [[ "$i" -eq 60 ]]; then
    echo "[verify] API never became ready" >&2
    "${DOCKER[@]}" compose logs api >&2 || true
    exit 1
  fi
done

ready="$(curl -sf http://127.0.0.1:8000/health/ready)"
echo "[verify] health: $ready"

body="$(curl -sf -X POST http://127.0.0.1:8000/finance/close-pass \
  -H 'Content-Type: application/json' \
  -d '{"user":"docker-verify"}')"
echo "$body" | python -c "
import json, sys
d = json.load(sys.stdin)
assert d.get('flagged_count') == 9, d
assert d.get('review_queued') == 2, d
print('[verify] close-pass OK flagged=9 review_queued=2 status=', d.get('status'))
"

# Streamlit should at least accept TCP
python -c "
import socket
s = socket.create_connection(('127.0.0.1', 8501), timeout=5)
s.close()
print('[verify] streamlit port 8501 open')
"

echo "[verify] PASS"
