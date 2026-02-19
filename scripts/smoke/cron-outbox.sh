#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-}"
if [[ -z "$CRON_SECRET" && -f ".env.local" ]]; then
  CRON_SECRET="$(grep -E '^CRON_SECRET=' .env.local | head -n1 | cut -d '=' -f2- | tr -d '\r' | sed 's/^"//' | sed 's/"$//')"
fi
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="evidence/outbox-smoke-${STAMP}"
EXPECTED_WITH_AUTH="${CRON_WITH_AUTH_EXPECT:-200}"
mkdir -p "$OUT_DIR"
[[ -n "$CRON_SECRET" ]]

no_auth="$(curl -sS -o "$OUT_DIR/no-auth.json" -w "%{http_code}" -X POST "$BASE_URL/api/cron/outbox")"
with_auth="$(curl -sS -o "$OUT_DIR/with-auth.json" -w "%{http_code}" -X POST "$BASE_URL/api/cron/outbox" -H "Authorization: Bearer $CRON_SECRET")"

echo "outbox no_auth=$no_auth with_auth=$with_auth" | tee "$OUT_DIR/summary.txt"
[[ "$no_auth" == "403" ]]
if [[ "$EXPECTED_WITH_AUTH" == "ANY_NON_403" ]]; then
  [[ "$with_auth" != "403" ]]
else
  [[ "$with_auth" == "$EXPECTED_WITH_AUTH" ]]
fi

