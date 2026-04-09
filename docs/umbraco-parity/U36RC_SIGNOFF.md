- Title: U36-RC signoff
- Scope: final signoff for the runtime changes shipped in U36-RC.
- Repro:
  1. Run the locked verification sequence.
  2. Inspect content workspace footer/history surfaces.
  3. Inspect settings object flows and degraded tree/audit banners.
- Expected: all required gates pass and the touched control-plane flows remain honest and deterministic.
- Actual: required gates passed and the targeted U36 surfaces now behave as intended.
- Root cause: remaining parity gaps were structural ownership gaps, not missing copy or missing labels.
- Fix: close those ownership gaps in canonical models/registries and verify broadly.
- Verification:
  - `npm run typecheck` -> PASS
  - `npm run lint` -> PASS
  - `npm run build:enterprise` -> PASS
  - `npm run test:run` -> PASS

## Signoff Summary

Signed off for U36-RC scope.

## Non-Regression Checklist

- Content entity workspace still mounts on the same canonical Bellissima context and model line.
- Footer/status/shortcut chips are rendered from canonical footer apps, not local recomposition.
- Settings collections still route through the shared management frame and now expose explicit object-flow metadata.
- Document types and data types remain code-governed, but are now legible as management objects.
- Degraded content tree still fails closed and keeps mutations locked where required.
- Degraded audit timeline still returns 200 + explicit degraded state instead of 500 for known schema/table failures.
- Command palette and discovery still read the same canonical registry after compat-barrel removal.

## Verification Notes

- `lint` and `build:enterprise` still report pre-existing non-blocking warnings from unrelated files; no new lint errors were introduced by U36.
- One full-suite async smoke test needed stabilization to remove timing flake under broad suite load.
- No manual browser/mobile pass was run in this signoff; verification was code + test + build based.
