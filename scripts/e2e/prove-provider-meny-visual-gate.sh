#!/usr/bin/env bash
# Prove provider meny visual gate bites: intentional CSS delta → RED → revert → GREEN.
# Run inside Linux Playwright container (see scripts/e2e/provider-meny-visual-docker.sh).
set -euo pipefail

CSS_FILE="app/styles/ds/provider-menu-editor.css"
MARKER="/* PROVIDER_MENY_VISUAL_GATE_PROBE */"

if [[ ! -f "$CSS_FILE" ]]; then
  echo "::error::Missing $CSS_FILE"
  exit 1
fi

if grep -q "$MARKER" "$CSS_FILE"; then
  echo "::error::Probe marker already present — revert before re-running"
  exit 1
fi

cp "$CSS_FILE" "${CSS_FILE}.gate-prove.bak"

# Deliberate visible delta on lp-editor namespace (must exceed screenshot diff threshold)
printf '\n%s\n.lp-editor-command-header__title { color: #ff0055 !important; }\n' "$MARKER" >> "$CSS_FILE"

echo "::group::Visual e2e with deliberate CSS delta (expect FAIL)"
set +e
npx playwright test --config playwright.provider-meny.config.ts --reporter=list
RED_EXIT=$?
set -e
echo "::endgroup::"

mv "${CSS_FILE}.gate-prove.bak" "$CSS_FILE"

if [[ "$RED_EXIT" -eq 0 ]]; then
  echo "::error::Gate bite proof FAILED — visual e2e stayed green after CSS delta"
  exit 1
fi

echo "GATE_BITE_PROOF_OK visual_e2e_exit=$RED_EXIT (expected non-zero)"

echo "::group::Visual e2e after revert (expect PASS)"
npx playwright test --config playwright.provider-meny.config.ts --reporter=list
echo "::endgroup::"
