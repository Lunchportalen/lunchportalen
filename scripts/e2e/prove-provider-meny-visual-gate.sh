#!/usr/bin/env bash
# Prove provider meny visual gate bites: runtime lp-editor style probe → RED → GREEN.
# Run inside Linux Playwright container after baselines exist.
set -euo pipefail

echo "::group::Visual e2e with deliberate lp-editor style probe (expect FAIL)"
set +e
LP_PROVIDER_MENY_VISUAL_GATE_PROBE=1 npx playwright test --config playwright.provider-meny.config.ts --reporter=list
RED_EXIT=$?
set -e
echo "::endgroup::"

if [[ "$RED_EXIT" -eq 0 ]]; then
  echo "::error::Gate bite proof FAILED — visual e2e stayed green after lp-editor style probe"
  exit 1
fi

echo "GATE_BITE_PROOF_OK visual_e2e_exit=$RED_EXIT (expected non-zero)"

echo "::group::Visual e2e without probe (expect PASS)"
npx playwright test --config playwright.provider-meny.config.ts --reporter=list
echo "::endgroup::"
