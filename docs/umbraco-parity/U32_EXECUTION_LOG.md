# U32 - Execution log

## 2026-03-30 baseline

- Read `AGENTS.md` before code changes.
- Confirmed scope is limited to content backoffice, settings, shared backoffice workspace files, tree/audit reliability, tests, and U32 docs.
- Confirmed frozen flows were not directly touched:
  - onboarding
  - auth/login loop logic
  - company lifecycle
  - employee ordering/runtime truth
- Read the required Bellissima/U30X/U31/control-plane references before editing runtime code.
- Verified the main structural gaps that still remained after U31:
  - no single canonical content host
  - shared workspace context still partial
  - views/actions/footer apps still split between model and local props
  - entity actions still inconsistent across tree and workspace
  - tree/audit degraded posture still not explicit enough

## Build log

- Created the six short U32 steering docs first.
- Added `ContentWorkspaceHost.tsx` and mounted it from `content/layout.tsx` as the canonical content host.
- Switched `/backoffice/content` back to the tree-first `ContentSectionLanding`.
- Expanded `ContentBellissimaWorkspaceContext` and `backofficeWorkspaceContextModel` into a real shared Bellissima workspace model.
- Routed `MainViewContext` through the shared workspace context as a compatibility layer.
- Moved header, footer apps, save bar, and entity action surfaces onto the same model-driven action/view line.
- Rebalanced preview/inspector shell proportions without creating a second editor shell.
- Tightened tree degraded messaging and audit degraded classification/operator messaging.
- Aligned the settings section with shared collection/workspace metadata.

## Stabilization log

- Fixed a linter issue in `BackofficeWorkspaceFooterApps.tsx`.
- Updated older snapshot-model tests to the richer U32 snapshot contract (`title` and `slug` now required).
- Updated the content landing smoke assertion to the real content-first copy.
- Tightened audit degraded classification so relation-missing maps to `TABLE_MISSING`.

## Verification log

- `npm run typecheck` -> PASS
- `npm run lint` -> PASS
- `npx vitest run tests/backoffice/content-page-smoke.test.tsx tests/cms/bellissimaWorkspaceContext.test.ts tests/cms/backofficeWorkspaceContextModel.test.ts tests/cms/backofficeExtensionRegistry.test.ts tests/cms/mapTreeApiRoots.test.ts tests/api/contentAuditLogRoute.test.ts --config vitest.config.ts` -> PASS
- `npm run test:run` -> PASS
- `npm run build:enterprise` -> PASS
- `npm run sanity:live` -> PASS (soft gate; local base was unreachable and skipped cleanly)

## Notes

- `npm run lint` still reports existing non-blocking warnings outside the U32 acceptance threshold.
- No frozen auth/system/onboarding/order flows were changed in this phase.
- U32 ended as a real runtime build phase, not a docs-only pass.
