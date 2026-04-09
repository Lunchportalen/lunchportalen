- Title: U36-RC open risks
- Scope: residual risk after U36 closure.
- Repro: inspect affected files and verification output.
- Expected: only honest, bounded residual risks remain.
- Actual: U36 is verification-green, but a few residual risks remain outside the exact closure target.
- Root cause: this phase closed structural ownership gaps, not every repo-wide warning or every historical shim.
- Fix: document residual risk explicitly instead of smuggling it into the phase.
- Verification: risks below were reviewed after green verification.

## Residual Risks

- `ContentWorkspaceActions.ts` still exists as a small import-integrity shim for the rescued repository and tests. It is not the live source of create logic, but it remains a compat artifact.
- Settings management objects are still code-governed read-models. This is intentional honesty, but future work that expects persisted CRUD will still require a real replatform.
- Repo-wide lint warnings unrelated to U36 remain in the codebase. They did not block this phase, but they still create signal noise during verification.
- The full test suite still emits many `act(...)` environment warnings in smoke tests. The suite passes, but warning noise makes new failures harder to spot quickly.
- No dedicated manual browser/mobile walkthrough was run for the updated settings surfaces in this signoff.
