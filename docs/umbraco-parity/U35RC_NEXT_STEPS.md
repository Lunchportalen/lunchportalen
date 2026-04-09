# U35RC Next Steps

- Title: U35RC next steps
- Scope: natural follow-up after the final structural/editor convergence delivered in U35RC.
- Repro: use only after U35RC is accepted.
- Expected: short, separable next moves rather than hidden scope stuffed into signoff.
- Actual: U35RC leaves a cleaner Bellissima control-plane base for narrower follow-up work.
- Root cause: a few improvements are still useful, but they are no longer required to close the structural phase.
- Fix: capture them explicitly as later follow-up options.
- Verification:
  - U35RC runtime closure: PASS
  - U35RC verification chain: PASS with the documented local `sanity:live` caveat

## Next Steps

- Continue decomposing `ContentWorkspace.tsx` so more editor runtime behavior lives in smaller Bellissima-aligned hooks/modules.
- Extract even more reusable collection/entity action builders if a later phase wants stronger parity beyond the current settings/content reuse.
- Add deeper integration coverage for section -> tree -> entity workspace -> history flows if later phases want more confidence than the current green unit/smoke line.
- Improve local verification ergonomics so `build:enterprise` and `sanity:live` produce more decisive host-local closeout signals without needing workaround logging.
