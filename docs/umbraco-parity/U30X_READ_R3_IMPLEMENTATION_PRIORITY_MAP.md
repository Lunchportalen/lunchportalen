# U30X-READ-R3 — Implementation priority map (brutal)

| Priority | Area | Exact files likely to change | Why | Risk | Expected UX/runtime impact |
|----------|------|------------------------------|-----|------|----------------------------|
| P0 | Tree + schema | `supabase/migrations/*`, `tree/route.ts` | Uten `content_pages` er alt degraded | Medium | Editor/tre brukbar |
| P0 | Audit timeline | `audit-log/route.ts`, `content_audit_log` migrasjon | Historikk tom | Medium | Tillit til redaksjonell sporbarhet |
| P1 | Content landing IA | `app/(backoffice)/backoffice/content/page.tsx`, `GrowthDashboard.tsx` | Bellissima forventer tree-first workspace | Medium | Redaktør-fokus |
| P1 | Layout dual path | `ContentWorkspaceLayout.tsx` | Konsistent URL ↔ selection | Medium | Færre «hvor er jeg»-bugs |
| P2 | Intelligence 500-hard | `intelligence/dashboard/route.ts`, `lib/ai/intelligence/*` | Fail-closed vs tree pattern | Medium | Stabil dashboard |
| P2 | Releases | `releases/route.ts`, `lib/backoffice/content/releasesRepo.ts` | 500 blokkerer releases | Medium | Planlagt publish |
| P3 | Workspace decomposition | `ContentWorkspace.tsx` (split) | Vedlikehold | Høy | Langsiktig Bellissima-nær struktur |
| P3 | Footer apps / entity actions | Nye primitives | Arkitektur | Høy | Paritet |

**Ikke røre uten egen gate:** `middleware.ts`, auth/post-login, frozen superadmin flows (per AGENTS.md).
