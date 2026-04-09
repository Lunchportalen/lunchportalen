# U32 - Verification

- Title: U32 verification and acceptance evidence
- Scope: U32 runtime changes across content host/context/views/actions/tree/audit/settings plus focused regression coverage.
- Repro:
  1. Change the content host/context model, view/action descriptors, tree/audit degraded posture, and settings chrome.
  2. Verify that the repo still typechecks, lints, tests, and builds.
- Expected: U32 changes pass the requested verification gates without introducing blocking regressions.
- Actual: verification completed green after one round of targeted test updates and a tighter audit degraded classification.
- Root cause of interim failures: older tests were still asserting pre-U32 snapshot signatures and legacy landing text; the audit degraded classifier also needed to stop conflating relation-missing with schema-cache drift.
- Fix: update the affected tests and tighten audit classification logic.
- Verification:
  - `npm run typecheck` -> PASS
  - `npm run lint` -> PASS
  - `npx vitest run tests/backoffice/content-page-smoke.test.tsx tests/cms/bellissimaWorkspaceContext.test.ts tests/cms/backofficeWorkspaceContextModel.test.ts tests/cms/backofficeExtensionRegistry.test.ts tests/cms/mapTreeApiRoots.test.ts tests/api/contentAuditLogRoute.test.ts --config vitest.config.ts` -> PASS
  - `npm run test:run` -> PASS
  - `npm run build:enterprise` -> PASS
  - `npm run sanity:live` -> PASS (soft gate; localhost health endpoint not reachable, command exited cleanly)

## Notes

- `npm run lint` still reports existing non-blocking warnings in unrelated files.
- `npm run sanity:live` did not hit a running local server and therefore skipped with a soft warning, which is the current script behavior.
- U32 verification is therefore green for code quality/build/test gates, with no blocking failures left in scope.
