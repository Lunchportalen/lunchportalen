| Kategori | Status | Evidence | Why | Required action |
|----------|--------|----------|-----|-----------------|
| Extension registry parity | GREEN | `backofficeExtensionRegistry.ts` | Single manifest | Keep consolidated |
| Sections / menus parity | GREEN | Shared section metadata in shell + settings + landing | Less drift across surfaces | Keep manifest canonical |
| Tree / workspace parity | GREEN | `contentTreeRoots.ts` + `ContentTree.tsx` + content landing | Same roots in API and UI | Keep one root source |
| Workspace context parity | GREEN | Snapshot now includes section/workspace/history/actions | Much closer to Bellissima context truth | Extend only if product needs more |
| Workspace views parity | YELLOW | Workspace apps + route tabs | Better semantics, not fully pluggable registry | Future registry only if needed |
| Workspace actions parity | GREEN | View-aware snapshot actions + calmer editor chrome | More coherent than scattered raw props | Keep action truth in snapshot |
| Footer app parity | GREEN | `BackofficeWorkspaceFooterApps.tsx` | Persistent strip with readable labels and history state | — |
| Entity actions parity | YELLOW | Tree menus | Consistent pattern | — |
| Property editor parity | YELLOW | `ContentWorkspacePropertiesRail.tsx` | Apps now better separated, but not full datatype UI | Code-governed remains truth |
| Management / delivery clarity | GREEN | Context strip + docs | Explicit | — |
| Discovery / quick find | GREEN | Command palette | Existing | — |
| Unified history parity | YELLOW | Footer status + version preview | Better visibility, still split surfaces | Consider single history workspace |
| Week/menu publishing from CMS | YELLOW | Existing surfaces | Not changed in U31 | Keep runtime truth |
| Settings section parity | GREEN | Settings chrome + live counts | Operational control-plane feel | — |
| Document type parity | YELLOW | Governed envelope + settings links | No persisted CRUD | Honest |
| Data type parity | YELLOW | Same | Same | Honest |
| Create policy parity | YELLOW | Policy pages | Same | — |
| AI governance / modularity | GREEN | AI tower + posture | Unchanged | — |
| Access/security | GREEN | Route guards | Unchanged | — |
| Cron/worker/job safety | GREEN | Not touched | — | — |
| Support/ops | YELLOW | Audit degraded UX + footer signals | Better operator visibility | Fix schema / migration |
| Scale confidence | GREEN | No new hot paths | — | — |
| Overall Umbraco 17 parity | YELLOW | UX workflow now stronger across landing/editor/footer | Stack and CRUD model still differ | Document gaps honestly |
