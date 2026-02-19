#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-}"
if [[ -z "$CRON_SECRET" && -f ".env.local" ]]; then
  CRON_SECRET="$(grep -E '^CRON_SECRET=' .env.local | head -n1 | cut -d '=' -f2- | tr -d '\r' | sed 's/^"//' | sed 's/"$//')"
fi
SYSTEM_MOTOR_SECRET="${SYSTEM_MOTOR_SECRET:-}"
if [[ -z "$SYSTEM_MOTOR_SECRET" && -f ".env.local" ]]; then
  SYSTEM_MOTOR_SECRET="$(grep -E '^SYSTEM_MOTOR_SECRET=' .env.local | head -n1 | cut -d '=' -f2- | tr -d '\r' | sed 's/^"//' | sed 's/"$//')"
fi
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="evidence/cron-smoke-${STAMP}"
mkdir -p "$OUT_DIR"
EXPECTED_WITH_AUTH="${CRON_WITH_AUTH_EXPECT:-200}"

if [[ -z "$CRON_SECRET" ]]; then
  echo "CRON_SECRET is required" | tee "$OUT_DIR/error.txt"
  exit 1
fi

check() {
  local method="$1"
  local path="$2"
  local expected_no_auth="${3:-403}"
  local expected_with_auth="${4:-200}"
  local secret_override="${5:-}"
  local secret_to_use="${secret_override:-$CRON_SECRET}"

  local no_auth_status
  no_auth_status="$(curl -sS -o "$OUT_DIR$(echo "$path" | tr '/' '_')_no_auth.json" -w "%{http_code}" -X "$method" "$BASE_URL$path")"

  local with_auth_status
  with_auth_status="$(curl -sS -o "$OUT_DIR$(echo "$path" | tr '/' '_')_with_auth.json" -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "Authorization: Bearer $secret_to_use")"

  local with_header_status
  with_header_status="$(curl -sS -o "$OUT_DIR$(echo "$path" | tr '/' '_')_with_x_cron_secret.json" -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "x-cron-secret: $secret_to_use")"

  echo "$method $path no_auth=$no_auth_status with_bearer=$with_auth_status with_x_cron_secret=$with_header_status" | tee -a "$OUT_DIR/summary.txt"

  [[ "$no_auth_status" == "$expected_no_auth" ]]
  if [[ "$expected_with_auth" == "ANY_NON_403" ]]; then
    [[ "$with_auth_status" != "403" ]]
    [[ "$with_header_status" != "403" ]]
  else
    [[ "$with_auth_status" == "$expected_with_auth" ]]
    [[ "$with_header_status" == "$expected_with_auth" ]]
  fi
}

check GET  /api/cron/week-scheduler 403 "$EXPECTED_WITH_AUTH"
check GET  /api/cron/forecast 403 "$EXPECTED_WITH_AUTH"
check GET  /api/cron/preprod 403 "$EXPECTED_WITH_AUTH"
check POST /api/cron/outbox 403 "$EXPECTED_WITH_AUTH"
check POST /api/cron/cleanup-invites 403 "$EXPECTED_WITH_AUTH"
check POST /api/cron/esg/daily 403 "$EXPECTED_WITH_AUTH"
check POST /api/cron/esg/monthly 403 "$EXPECTED_WITH_AUTH"
check POST /api/cron/esg/yearly 403 "$EXPECTED_WITH_AUTH"
check POST /api/cron/system-motor 403 "$EXPECTED_WITH_AUTH" "$SYSTEM_MOTOR_SECRET"

echo "PASS" | tee -a "$OUT_DIR/summary.txt"
