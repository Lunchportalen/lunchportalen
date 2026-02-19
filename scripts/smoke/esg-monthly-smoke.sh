#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-}"
MONTH="${MONTH:-$(date +%Y-%m)}"

if [[ -z "$CRON_SECRET" && -f ".env.local" ]]; then
  CRON_SECRET="$(grep -E '^CRON_SECRET=' .env.local | head -n1 | cut -d '=' -f2- | tr -d '\r' | sed 's/^"//' | sed 's/"$//')"
fi

if [[ -z "$CRON_SECRET" ]]; then
  echo "CRON_SECRET is required"
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="evidence/esg-monthly-smoke-${STAMP}"
mkdir -p "$OUT_DIR"

URL="$BASE_URL/api/cron/esg/generate?month=$MONTH"

HTTP_CODE_1="$(curl -sS -o "$OUT_DIR/run1.json" -w "%{http_code}" -X GET "$URL" -H "Authorization: Bearer $CRON_SECRET")"
HTTP_CODE_2="$(curl -sS -o "$OUT_DIR/run2.json" -w "%{http_code}" -X GET "$URL" -H "Authorization: Bearer $CRON_SECRET")"

echo "status1=$HTTP_CODE_1 status2=$HTTP_CODE_2 month=$MONTH" | tee "$OUT_DIR/summary.txt"

[[ "$HTTP_CODE_1" == "200" ]]
[[ "$HTTP_CODE_2" == "200" ]]
grep -q '"ok":true' "$OUT_DIR/run1.json"
grep -q '"ok":true' "$OUT_DIR/run2.json"

echo "PASS" | tee -a "$OUT_DIR/summary.txt"

