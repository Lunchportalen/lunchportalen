# U35RC Open Risks

- Title: U35RC open risks
- Scope: residual risks after landing the U35RC structural/editor convergence work.
- Repro: review together with the traffic-light matrix, execution log, and changed-file ledger.
- Expected: short list of true residual risks only.
- Actual: U35RC closes the target architectural gaps, but a few operational and scale follow-ups remain outside this change-set.
- Root cause: the remaining items are separable from the structural closure itself.
- Fix: document them explicitly instead of stretching the phase into unrelated follow-up work.
- Verification:
  - `npm run typecheck`: PASS
  - `npm run lint`: PASS
  - Direct RC `next build`: PASS
  - `npm run test:run`: PASS

## Open Risks

- `ContentWorkspace.tsx` is still a large runtime component even though Bellissima ownership and vocabulary are cleaner now.
- Settings workspaces are management-real and explicit, but they still reflect code-governed/runtime-read truth rather than a fully persisted CRUD model because that is still the product contract.
- Local `build:enterprise` terminal capture on this host can lose the final wrapper footer after `next build`, so direct build logs are currently the more reliable local proof artifact.
- `sanity:live` can only soft-verify when no reachable local or public app base URL is available; a deployed/local running target is still required for full live-path confirmation.
- Full Umbraco 17 technical identity still has stack-level limits beyond workflow/control-plane parity on Next.js.
