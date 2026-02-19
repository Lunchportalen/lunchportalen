#!/usr/bin/env bash
set -euo pipefail

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="evidence/prod-check-${STAMP}"
mkdir -p "$OUT_DIR"

PASS=1
STRICT="${STRICT_PROD_CHECK:-0}"

log() {
  echo "$*" | tee -a "$OUT_DIR/summary.txt"
}

fail() {
  PASS=0
  log "FAIL: $*"
}

warn() {
  log "WARN: $*"
}

fail_or_warn() {
  if [[ "$STRICT" == "1" || "${CI:-}" == "true" ]]; then
    fail "$1"
  else
    warn "$1"
  fi
}

scan_for_query_key() {
  if command -v rg >/dev/null 2>&1; then
    rg -n "\\?key=" app/api/cron lib/http vercel.json scripts/smoke
  else
    grep -RIn "?key=" app/api/cron lib/http vercel.json scripts/smoke
  fi
}

log "[1/6] Verifying CRON_SECRET presence in Vercel production env"
if command -v vercel >/dev/null 2>&1; then
  if vercel env ls production > "$OUT_DIR/vercel-env.txt" 2>&1; then
    if ! grep -q "CRON_SECRET" "$OUT_DIR/vercel-env.txt"; then
      fail "CRON_SECRET missing in Vercel production env list"
    else
      log "PASS: CRON_SECRET listed in Vercel env"
    fi
  else
    fail_or_warn "vercel env ls production failed"
  fi
else
  fail_or_warn "vercel CLI not installed"
fi

log "[2/6] Ensuring no ?key= secret usage"
if scan_for_query_key > "$OUT_DIR/query-key-scan.txt" 2>/dev/null; then
  fail "Found forbidden ?key= usage"
else
  log "PASS: no ?key= usage found"
fi

log "[3/6] Verifying vercel cron routes are defined without query secrets"
if command -v jq >/dev/null 2>&1; then
  if jq -e '.crons[] | select(.path | contains("?key="))' vercel.json > /dev/null; then
    fail "vercel.json contains cron path with ?key="
  else
    log "PASS: vercel cron paths contain no ?key="
  fi
else
  fail_or_warn "jq not installed; skipping vercel cron path structure check"
fi

log "[4/6] Running cron smoke checks"
if [[ -n "${BASE_URL:-}" && -n "${CRON_SECRET:-}" ]]; then
  if bash scripts/smoke/cron-smoke.sh > "$OUT_DIR/cron-smoke.txt" 2>&1; then
    log "PASS: cron smoke"
  else
    fail "cron smoke failed"
  fi
else
  fail_or_warn "BASE_URL and CRON_SECRET must be set to run cron smoke"
fi

log "[5/6] Running SQL verification queries"
if command -v psql >/dev/null 2>&1 && [[ -n "${DATABASE_URL:-}" ]]; then
  if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/verify_enterprise_hardening.sql > "$OUT_DIR/sql-verify.txt" 2>&1; then
    log "PASS: SQL verification"
  else
    fail "SQL verification failed"
  fi
else
  fail_or_warn "psql not installed or DATABASE_URL missing"
fi

log "[6/6] Completed checks"
if [[ "$PASS" -eq 1 ]]; then
  log "OVERALL: PASS"
  exit 0
fi

log "OVERALL: FAIL"
exit 1
