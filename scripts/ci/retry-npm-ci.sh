#!/usr/bin/env bash
# CI-only: npm ci with registry fetch tuning + outer retry for transient network flakes.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=retry-transient-network.sh
source "${SCRIPT_DIR}/retry-transient-network.sh"

npm config set fetch-retries 3
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000

ci_retry_step "npm-ci" npm ci

echo "[ci-retry] npm ci complete"
