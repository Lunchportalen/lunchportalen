# U33 Open Risks

- Title: U33 open risks
- Scope: residual risk after landing the U33 runtime consolidation.
- Repro: review alongside changed files and traffic light matrix.
- Expected: short list of real residual risks only.
- Actual: U33 closes the core runtime gaps, but some follow-up work remains.
- Root cause: current stack still has Bellissima parity limits that are outside this localized phase.
- Fix: record the remaining risks explicitly instead of hiding them.
- Verification:
  - Focused Vitest suite: PASS
  - Final RC gate rerun: PASS (`typecheck`, `lint`, `build:enterprise`)

## Open Risks

- `ContentWorkspace.tsx` is still a very large runtime component even though more shell truth now sits in shared context.
- Header/topbar simplification can go further if later phases want even stricter section-first Bellissima posture.
- Settings still reflects code-governed truth more than fully persisted CRUD because that is the current product/runtime contract.
- Public preview/runtime linkage for pages still depends on existing slug/runtime truth rather than a separate CMS delivery layer.
