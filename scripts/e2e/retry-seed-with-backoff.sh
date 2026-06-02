#!/usr/bin/env bash
# CI-only: retry transient Supabase/network seed failures; fail hard on real seed errors.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../ci/retry-transient-network.sh
source "${SCRIPT_DIR}/../ci/retry-transient-network.sh"

: "${DATABASE_URL:?DATABASE_URL required for seed chain}"

ci_retry_step "seed-staging-tenant.sql" \
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/smoke/seed-staging-tenant.sql

ci_retry_step "seed-smoke-menu-fixture.mjs" \
  node scripts/smoke/seed-smoke-menu-fixture.mjs

ci_retry_step "seed-e2e-users.mjs" \
  node scripts/smoke/seed-e2e-users.mjs

echo "[ci-retry] seed chain complete"
