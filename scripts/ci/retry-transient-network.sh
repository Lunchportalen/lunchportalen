#!/usr/bin/env bash
# Shared CI helper: retry transient network/registry failures; fail hard on real errors.
# Source this file — do not execute directly.

CI_RETRY_MAX_ATTEMPTS="${CI_RETRY_MAX_ATTEMPTS:-3}"
CI_RETRY_BACKOFF_SEC="${CI_RETRY_BACKOFF_SEC:-15}"

ci_is_retryable_transient_failure() {
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
    "network read" \
    "network connectivity" \
    "network" \
    "timeout" \
    "Timeout" \
    "socket hang up" \
    "Service Unavailable" \
    "registry.npmjs.org" \
    "503" \
    "502" \
    "504"; do
    if [[ "$output" == *"$pattern"* ]]; then
      return 0
    fi
  done
  return 1
}

ci_retry_step() {
  local label="$1"
  shift

  local attempt output exit_code
  for attempt in $(seq 1 "$CI_RETRY_MAX_ATTEMPTS"); do
    echo "[ci-retry] ${label}: attempt ${attempt}/${CI_RETRY_MAX_ATTEMPTS}"
    set +e
    output="$("$@" 2>&1)"
    exit_code=$?
    set -e

    if [ "$exit_code" -eq 0 ]; then
      echo "[ci-retry] ${label}: OK"
      if [ -n "$output" ]; then
        printf '%s\n' "$output"
      fi
      return 0
    fi

    printf '%s\n' "$output"

    if ! ci_is_retryable_transient_failure "$output"; then
      echo "::error::[ci-retry] ${label}: hard failure (non-retryable, exit ${exit_code})"
      return "$exit_code"
    fi

    if [ "$attempt" -lt "$CI_RETRY_MAX_ATTEMPTS" ]; then
      local wait_sec=$((attempt * CI_RETRY_BACKOFF_SEC))
      echo "[ci-retry] ${label}: transient failure — sleeping ${wait_sec}s before retry"
      sleep "$wait_sec"
    fi
  done

  echo "::error::[ci-retry] ${label}: failed after ${CI_RETRY_MAX_ATTEMPTS} attempts (retryable errors exhausted)"
  return "$exit_code"
}
