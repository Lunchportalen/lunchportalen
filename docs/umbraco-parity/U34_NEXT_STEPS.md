# U34 Next Steps

- Title: U34 next steps
- Scope: natural follow-up after the structural closure delivered in U34.
- Repro: use only after U34 is accepted.
- Expected: short list of focused follow-up moves, not a new phase stuffed into signoff.
- Actual: U34 leaves a cleaner control-plane base for narrower follow-up work.
- Root cause: some improvements are separable and should stay out of the closure phase.
- Fix: capture the next likely moves explicitly.
- Verification:
  - Focused U34 vitest pass: PASS
  - Final RC gate rerun: PASS (`typecheck`, `lint`, `build:enterprise`, `test:run`)

## Next Steps

- Continue decomposing `ContentWorkspace.tsx` so more editor runtime behavior lives in smaller Bellissima-aligned hooks/modules.
- Expand collection/entity action reuse beyond content/settings if later phases want even stronger section/workspace parity.
- Add deeper end-to-end coverage for section -> tree -> workspace -> preview -> history flows if a later phase wants more confidence than the current focused/unit-heavy coverage.
- Revisit topbar/global-vs-section composition later if the product wants an even stricter Bellissima section-first shell.
