# U33 Next Steps

- Title: U33 next steps
- Scope: natural follow-up after the core runtime consolidation.
- Repro: use only after U33 is accepted.
- Expected: small, real next steps rooted in remaining structural gaps.
- Actual: U33 leaves a clear path for the next parity moves.
- Root cause: some improvements are separable and should not be packed into the core rebuild.
- Fix: list the next focused phases instead of stretching U33 further.
- Verification:
  - Focused Vitest suite: PASS
  - Final RC gate rerun: PASS (`typecheck`, `lint`, `build:enterprise`)

## Next Steps

- Continue decomposing `ContentWorkspace.tsx` so more entity runtime logic becomes smaller, testable modules under the shared control plane.
- Tighten topbar/section composition further if the project wants even closer Bellissima section dominance.
- Expand settings workspaces for data types and create policy with the same collection/detail management posture now used for document types.
- Add a broader integration pass for tree -> workspace -> preview -> history flows if a later phase wants more end-to-end coverage.
