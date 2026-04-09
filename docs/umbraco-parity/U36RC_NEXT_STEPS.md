- Title: U36-RC next steps
- Scope: true follow-up after U36 closure.
- Repro: read only after accepting U36 as closed.
- Expected: short list of follow-up work that is real but not required for U36 signoff.
- Actual: a few follow-up items remain, but none block U36.
- Root cause: some work belongs to later stabilization or replatform phases, not to this closure sprint.
- Fix: keep post-U36 steps separate from U36 signoff.
- Verification: each next step is outside the must-pass U36 gate.

## Next Steps

- Decide whether to fully retire `ContentWorkspaceActions.ts` by replacing the import-integrity expectation that still keeps the shim alive.
- Run a separate stabilization pass for repo-wide lint warnings and `act(...)` warning noise so future verification output becomes sharper.
- If Bellissima parity should go beyond code-governed honesty, scope a separate replatform phase for persisted management objects rather than extending the current read-model surfaces incrementally.
