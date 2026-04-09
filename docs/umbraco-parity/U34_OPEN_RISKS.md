# U34 Open Risks

- Title: U34 open risks
- Scope: real residual risks after landing the U34 structural closure.
- Repro: review together with the traffic-light matrix and changed-file ledger.
- Expected: short list of remaining risks only.
- Actual: U34 closes the targeted structural gaps, but a few broader follow-ups remain outside this change-set.
- Root cause: the current stack still carries some scale/complexity limits that are separable from U34 itself.
- Fix: document the residual risk explicitly instead of stretching the phase further.
- Verification:
  - Focused U34 vitest pass: PASS
  - Final RC gate rerun: PASS (`typecheck`, `lint`, `build:enterprise`, `test:run`)

## Open Risks

- `ContentWorkspace.tsx` is still a large runtime component even though Bellissima ownership is cleaner now.
- Settings workspaces are management-real and honest, but they still reflect code-governed/runtime-read truth more than fully persisted CRUD because that is the current product contract.
- Topbar/section composition is calmer than before, but an even stricter Bellissima section dominance is still possible in a later phase.
- Full Umbraco 17 technical identity still has stack-level limits beyond workflow/control-plane parity on Next.js.
