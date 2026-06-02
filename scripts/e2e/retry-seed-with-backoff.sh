#!/usr/bin/env bash
# CI-only: retry transient Supabase/network seed failures; fail hard on real seed errors.
set -euo pipefail

MAX_ATTEMPTS="${SEED_RETRY_MAX_ATTEMPTS:-3}"
BACKOFF_SEC="${SEED_RETRY_BACKOFF_SEC:-15}"

is_retryable_seed_failure() {
  local output="$1"
  local pattern
  for pattern in \
    "Connection timed out" \
    "connection to server" \
    "could not connect" \
    "ECONNRESET" \
    "ECONNREFUSED" \
    "ETIMEDOUT" \
    "ENOTFOUND" \
    "EAI_AGAIN" \
    "fetch failed" \
    "network" \
    "timeout" \
    "Timeout" \
    "socket hang up" \
    "Service Unavailable" \
    "503" \
    "502" \
    "504"; do
    if [[ "$output" == *"$pattern"* ]]; then
      return 0
    fi
  done
  return 1
}

retry_seed_step() {
  local label="$1"
  shift

  local attempt output exit_code
  for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
    echo "[seed-retry] ${label}: attempt ${attempt}/${MAX_ATTEMPTS}"
    set +e
    output="$("$@" 2>&1)"
    exit_code=$?
    set -e

    if [ "$exit_code" -eq 0 ]; then
      echo "[seed-retry] ${label}: OK"
      if [ -n "$output" ]; then
        printf '%s\n' "$output"
      fi
      return 0
    fi

    printf '%s\n' "$output"

    if ! is_retryable_seed_failure "$output"; then
      echo "::error::[seed-retry] ${label}: hard failure (non-retryable, exit ${exit_code})"
      return "$exit_code"
    fi

    if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
      local wait_sec=$((attempt * BACKOFF_SEC))
      echo "[seed-retry] ${label}: transient failure — sleeping ${wait_sec}s before retry"
      sleep "$wait_sec"
    fi
  done

  echo "::error::[seed-retry] ${label}: failed after ${MAX_ATTEMPTS} attempts (retryable errors exhausted)"
  return "$exit_code"
}

: "${DATABASE_URL:?DATABASE_URL required for seed chain}"

retry_seed_step "seed-staging-tenant.sql" \
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/smoke/seed-staging-tenant.sql

retry_seed_step "seed-smoke-menu-fixture.mjs" \
  node scripts/smoke/seed-smoke-menu-fixture.mjs

retry_seed_step "seed-e2e-users.mjs" \
  node scripts/smoke/seed-e2e-users.mjs

echo "[seed-retry] seed chain complete"
