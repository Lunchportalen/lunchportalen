# U30X-READ-R2 — Implementation priority map (neste byggefase)

**Brutal prioritering.** “Exact files likely to change” er **sannsynlige** berørte filer — ikke garanti.

| Priority | Area | Exact files likely to change | Why | Risk | Expected UX/runtime impact |
|----------|------|------------------------------|-----|------|----------------------------|
| **P0** | **Content landing IA** | `app/(backoffice)/backoffice/content/page.tsx`, `lib/cms/backofficeExtensionRegistry.ts`, ev. `TopBar.tsx` | `/backoffice/content` er **GrowthDashboard**, ikke editor — største brukerforvirring | Middels (nav) | Klar “åpne side / tre” flyt |
| **P0** | **Workspace layout duality** | `ContentWorkspaceLayout.tsx`, `content/[id]/page.tsx` | To måter å hoste editor — vedlikeholdsbyrde | Høy | Færre edge cases |
| **P0** | **Tree + pages API robusthet** | `app/api/backoffice/content/tree/route.ts`, `lib/cms/treeRouteSchema.ts`, `lib/cms/contentTreePageKey.ts` | Kjerne navigasjon | Lav hvis kun defensivt | Stabil tre |
| **P0** | **Persistence / PATCH** | `contentWorkspace.persistence.ts`, `app/api/backoffice/content/pages/[id]/route.ts` | Lagring er sannhet | Høy | Data tap = showstopper |
| **P1** | **ContentWorkspace modularisering** | `ContentWorkspace.tsx` (split), `ContentWorkspaceFinalComposition.tsx`, relevante `useContentWorkspace*` | Monolitt vanskelig å teste | Høy | Raskere iterasjon |
| **P1** | **Block modal / picker konsistens** | `BlockAddModal.tsx`, `BlockPickerOverlay.tsx`, `ContentWorkspaceModalStack.tsx`, `blockAllowlistGovernance.ts` | To innganger må matche allowlist | Middels | Færre “tilsynelatende tillatt” feil |
| **P1** | **Document type modell** | `lib/cms/contentDocumentTypes.ts`, `documentTypes.ts` (app), settings pages | Umbraco-lignende krever mer enn `page` | Middels | Bedre create-flow |
| **P1** | **Audit degradering UI** | Klient som leser `GET .../audit-log` | `degraded` flagg må vises | Lav | Tillit til historikk |
| **P2** | **AI panels** | `useContentWorkspaceAi.ts`, `app/api/backoffice/ai/**` | Mange endepunkter; feil isoleres ofte | Varierer | Valgfrie forbedringer |
| **P2** | **Releases pipeline** | `app/api/backoffice/releases/**` | Adjacent til publish | Middels | Avhengig av produkt-scope |
| **P2** | **Studio / deprecated** | `studio/lunchportalen-studio/DEPRECATED.md` | Opprydding | Lav | Mindre støy |

## Ikke rør først (uten eksplisitt instruks)

- `middleware.ts`, `app/api/auth/post-login/**` (AGENTS låst)
- Frozen superadmin flows utenom eksplisitt scope
- Store refactors av `ContentWorkspace.tsx` uten målrettet mål
