#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-}"
PERIOD="${PERIOD:-$(date +%Y-%m)}"

if [[ -z "$CRON_SECRET" && -f ".env.local" ]]; then
  CRON_SECRET="$(grep -E '^CRON_SECRET=' .env.local | head -n1 | cut -d '=' -f2- | tr -d '\r' | sed 's/^"//' | sed 's/"$//')"
fi

if [[ -z "$CRON_SECRET" ]]; then
  echo "CRON_SECRET is required"
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="evidence/invoice-period-smoke-${STAMP}"
mkdir -p "$OUT_DIR"

URL="$BASE_URL/api/cron/invoices/generate?period=$PERIOD"
HTTP_CODE="$(curl -sS -o "$OUT_DIR/with-auth.json" -w "%{http_code}" -X GET "$URL" -H "Authorization: Bearer $CRON_SECRET")"

cat "$OUT_DIR/with-auth.json" > "$OUT_DIR/response.json"
echo "status=$HTTP_CODE period=$PERIOD" | tee "$OUT_DIR/summary.txt"

[[ "$HTTP_CODE" == "200" ]]
grep -q '"ok":true' "$OUT_DIR/response.json"

echo "PASS" | tee -a "$OUT_DIR/summary.txt"
