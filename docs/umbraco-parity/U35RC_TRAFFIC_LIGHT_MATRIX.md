# U35RC Traffic Light Matrix

- Title: U35RC traffic light matrix
- Scope: final structural/editor convergence targets delivered in U35RC.
- Repro: compare the final runtime against the U35RC steering docs and Bellissima parity targets.
- Expected: close the remaining yellow/red structural gaps from U34 without introducing new wrapper systems.
- Actual: the remaining publish/inspector/settings/history/action gaps were closed on the current stack.
- Root cause: parity primitives existed, but the final ownership and vocabulary edges were still split across a few compat-era surfaces.
- Fix: U35RC converged those last edges onto one provider/model/action/status line.
- Verification:
  - `npm run typecheck`: PASS
  - `npm run lint`: PASS
  - Direct RC `next build`: PASS
  - `npm run seo:proof`, `npm run seo:audit`, `npm run seo:content-lint`: PASS
  - `npm run test:run`: PASS
  - `npm run sanity:live`: soft PASS / skipped locally

| Area | Status | Notes |
| --- | --- | --- |
| Section vs entity publication truth | GREEN | Provider now separates section and entity workspace publication so one scope no longer overwrites the other. |
| Inspector compat shutdown | GREEN | Live `legacyPageTab` vocabulary is removed from the active content runtime path. |
| Canonical workspace label truth | GREEN | Content view labels resolve from the registry instead of duplicated helper copy. |
| Settings overview as management workspace | GREEN | Settings overview now behaves like a management object workspace, not a descriptive hub. |
| Governance insights workspace parity | GREEN | Governance/usage is framed through the same management workspace model as the rest of settings. |
| System/drift workspace parity | GREEN | System settings now sits on the shared management frame/model instead of a separate page posture. |
| Settings registry duplication | GREEN | Duplicate settings nav-group truth is removed. |
| History status single truth line | GREEN | Shared history tone/status helpers now own status semantics across header, footer, history view, and audit timeline. |
| Collection action vocabulary | GREEN | Document-type and data-type collection cards now use the canonical Bellissima open-action label. |
| Tree/audit degraded honesty | GREEN | Degraded/runtime detail stays explicit without competing status chips. |
| Enterprise wrapper terminal capture | YELLOW | On this host the `build:enterprise` terminal capture dropped the final footer after `next build`; underlying gates plus direct `next build` were green. |
| `sanity:live` local reachability | YELLOW | Script exited soft-green because no reachable local app URL was available. |
| `ContentWorkspace.tsx` size | YELLOW | Ownership is cleaner, but the editor runtime component is still larger than ideal. |
| Full Umbraco technical identity | YELLOW | Workflow/control-plane parity is stronger, but stack-level .NET internals remain outside the Next.js runtime. |
