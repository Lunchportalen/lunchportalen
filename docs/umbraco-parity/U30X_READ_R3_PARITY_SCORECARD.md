# U30X-READ-R3 — Parity scorecard (sluttdom)

| Subsystem | Exact files | Parity class | Why | Biggest blockers | Replatforming gap? | Next step |
|-----------|-------------|--------------|-----|------------------|---------------------|-----------|
| Backoffice registry | `lib/cms/backofficeExtensionRegistry.ts` | **UX_PARITY_ONLY** | Statisk manifest | Ingen dynamiske extensions | Ja hvis Bellissima | — |
| Section model | `BackofficeNavGroupId`, `SectionShell.tsx` | **UX_PARITY_ONLY** | Layout | Ikke Umbraco section API | Delvis | — |
| Tree model | `tree/route.ts`, `ContentTree.tsx` | **PARTIAL** | Fungerer; superadmin gate; virtual roots | DB drift / degraded | Delvis | Sikre migrasjoner |
| Workspace model | `ContentWorkspace.tsx`, `ContentWorkspaceLayout.tsx` | **STRUCTURAL_GAP** | Monolitt + dual mount | Landing + state | Ja | Workspace host design |
| Workspace context | `backofficeWorkspaceContextModel.ts`, strip | **PARTIAL** / **STRUCTURAL_GAP** | Ingen global editor context | State spredt | Ja | Context layer |
| Workspace views | Diverse `*Shell.tsx` | **UX_PARITY_ONLY** | Ikke manifest views | — | Ja | — |
| Workspace actions | `ContentSaveBar.tsx`, `ContentWorkspaceActions.ts` | **PARTIAL** | Ikke action registry | — | Ja | — |
| Footer apps | *ingen* | **STRUCTURAL_GAP** | 0 treff | — | Ja | — |
| Entity actions | Domain surfaces + strip | **PARTIAL** | Ikke CMS entity framework | — | Ja | — |
| Discovery | `discovery-entity-bundle` route, palette | **PARTIAL** | Client filter | — | Delvis | — |
| History | `audit-log/route.ts`, panels | **DEGRADED** hvis tabell mangler | Tom liste | DB | Delvis | Migrasjon |
| Settings | `backoffice/settings` | **PARTIAL** | Ikke Umbraco settings model | — | Ja | — |
| Document types | `contentDocumentTypes.ts` | **STRUCTURAL_GAP** | Minimal | Kun `page` i lib path | Ja | — |
| Data types | `blockFieldSchemas.ts` | **STRUCTURAL_GAP** | Code-only | — | Ja | — |
| Blocks/modals | `Block*`, `ContentWorkspaceModalStack.tsx` | **PARTIAL** | Fungerende | Modal load | Delvis | — |
| Preview | `ContentWorkspacePreviewPane`, `LivePreviewPanel.tsx` | **PARTIAL** | — | — | Delvis | — |
| Inspector | `ContentWorkspacePropertiesRail.tsx` | **UX_PARITY_ONLY** | — | — | Delvis | — |
| AI governance | `moduleLivePosture.ts`, AI routes | **PARTIAL** | STUB/LIMITED ærlig | `worker_jobs` STUB | Delvis | — |
| Management vs delivery | `lib/cms/public/*` vs `app/api/backoffice/*` | **CODE_GOVERNED** | App-grense | Samme DB | Medium | API design |

**Samlet:** **ingen** subsystem **FULL_PARITY** med Umbraco 17 Bellissima; nærmeste **CODE_GOVERNED** / **RUNTIME_TRUTH** på API-kontrakter og degradert håndtering.
