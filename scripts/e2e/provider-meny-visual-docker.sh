#!/usr/bin/env bash
# Generate or verify /leverandor/meny visual baselines inside Playwright Docker (Linux rendering).
set -euo pipefail

IMAGE="${PLAYWRIGHT_DOCKER_IMAGE:-mcr.microsoft.com/playwright:v1.58.2-noble}"
MODE="${1:-verify}"
ENV_FILE="${PROVIDER_MENY_VISUAL_ENV_FILE:-.env.local}"

UPDATE_FLAGS=""
if [[ "$MODE" == "--update-snapshots" || "$MODE" == "update" ]]; then
  UPDATE_FLAGS="--update-snapshots"
fi

ENV_MOUNT=()
if [[ -f "$ENV_FILE" ]]; then
  ENV_MOUNT=(--env-file "$ENV_FILE")
fi

docker run --rm \
  -v "$(pwd):/work" \
  -w /work \
  "${ENV_MOUNT[@]}" \
  -e CI=true \
  -e LP_E2E_EXTERNAL_SERVER=1 \
  -e PLAYWRIGHT_BASE_URL=http://host.docker.internal:3000 \
  -e E2E_TEST_USER_EMAIL="${E2E_TEST_USER_EMAIL:-}" \
  -e E2E_TEST_USER_PASSWORD="${E2E_TEST_USER_PASSWORD:-}" \
  --add-host=host.docker.internal:host-gateway \
  "$IMAGE" \
  bash -lc "
    npx playwright test --config playwright.provider-meny.config.ts --reporter=list ${UPDATE_FLAGS}
  "
