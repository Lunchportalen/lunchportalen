- Title: U36-RC traffic light matrix
- Scope: hard-exit requirements and U36 closure status.
- Repro: compare this matrix with runtime changes, docs, and verification output.
- Expected: green where U36 closed the gap; yellow only where honesty or deferred scope still applies.
- Actual: most structural exit criteria are green; one residual compat/testing risk remains yellow.
- Root cause: U36 targeted the last structural ownership gaps, not a full persisted-type replatform.
- Fix: close what belongs to U36 and document what remains intentionally out of scope.
- Verification: matrix lines trace to changed files and passing gates.

| Area | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Workspace context is sole canonical truth for shared shell/footer state | GREEN | `lib/cms/backofficeWorkspaceContextModel.ts`, `components/backoffice/BackofficeWorkspaceFooterApps.tsx` | Footer apps now render from model-owned grouped primitives. |
| Document types and data types read as first-class management objects | GREEN | settings collection/detail pages for document types and data types | Collection -> detail flow is explicit and linked to related objects. |
| Property editor layer is explicit between schema, instance, UI, and presets | GREEN | `lib/cms/backofficeSchemaSettingsModel.ts`, schema/data-type workspaces | One shared read-model now surfaces the full relation graph. |
| Collections and entity actions are consistent across settings/workspace flows | GREEN | workspace action labels + settings action menus | Schema/management actions now use canonical action language. |
| Footer apps are real persistent workspace primitives | GREEN | footer groups in workspace model and shared renderer | Footer no longer recomposes local truth. |
| Settings feels like a management section, not docs in-product | GREEN | schema, create-policy, management-read, document/data type workspaces | Surfaces now show object rows, relations, and explicit flow metadata. |
| Compat/transitional layers still compete for same truth | YELLOW | `lib/cms/backofficeNavItems.ts` removed; `ContentWorkspaceActions.ts` shim still exists for import-integrity | Live compat barrel is gone, but one test-support shim remains documented. |
| Tree/audit degraded state is honest and operator-useful | GREEN | `operatorAction` in tree/audit routes + UI banners | Payload now tells operator what to do next, not just that degradation exists. |
| Bellissima-like management/workspace behavior is materially stronger than docs-only closure | GREEN | settings object model, footer truth closure, degraded operator UX | Phase delivered structural behavior, not cosmetic parity. |
| Clear collection -> workspace flow for doc types, data types, create policy, management read, AI governance | GREEN | settings registry metadata + updated workspaces | Flow metadata is explicit in chrome/frame and reflected in the pages. |
| `npm run typecheck` | GREEN | passed | No type errors from U36 changes. |
| `npm run lint` | GREEN | passed with pre-existing warnings | No new lint errors introduced. |
| `npm run build:enterprise` | GREEN | passed | Full enterprise chain and SEO checks passed. |
| `npm run test:run` | GREEN | passed | Full suite green after stabilizing one async smoke test. |
