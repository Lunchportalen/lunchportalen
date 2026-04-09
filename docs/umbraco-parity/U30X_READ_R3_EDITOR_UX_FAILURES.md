# U30X-READ-R3 — Editor UX failures

**Skjermbilder vedlagt:** nei — **ingen visuell runtime-verifikasjon** i denne fasen. Tabellen under er **kode- og struktur-basert** (arkitektur som sannsynliggjør UX-problemer).

## Problem-tabell

| Problem | Where seen (code) | Severity | Why it hurts editor workflow | Bellissima concept violated | Likely owning files |
|---------|-------------------|----------|------------------------------|----------------------------|---------------------|
| Content «home» er ikke editor-first | `content/page.tsx` → `GrowthDashboard` | **Høy** | Redaktør lander på growth/AI-analyse, ikke tre-valgt side | **workspace entry** / **collection** | `page.tsx`, `GrowthDashboard.tsx` |
| To veier inn i editor (tree vs deep link) | `ContentWorkspaceLayout.tsx` `selectedNodeId ? … : children` | **Medium** | Risiko for mismatch mellom URL og intern valgt node | **workspace consistency** | `ContentWorkspaceLayout.tsx` |
| Tree delete låst | `permissionsForNode` `canDelete: false` | **Medium** | Forventet CMS lifecycle ikke tilgjengelig | **entity actions** | `ContentTree.tsx` |
| Modal-stack kompleksitet | `ContentWorkspaceModalStack.tsx` | **Medium** | Mange overlappende flater | **calm workspace** | Modal stack + `ContentWorkspace.tsx` |
| Stor monolittisk workspace | `ContentWorkspace.tsx` | **Medium** | Vedlikehold/mental load | **composable workspace** | `ContentWorkspace.tsx` |
| Editor2 shell placeholder | `_stubs.ts` `Editor2Shell` → `null` | **Lav** (eksplisitt) | Forvirring hvis docs sier «2.0 klar» | — | `_stubs.ts` |
| Demo/WoW/pitch modus | `useContentWorkspaceUrlModeFlags` | **Lav–Medium** | Kan forstyrre «redaksjonell sannhet» | **management** tone | `ContentWorkspace.tsx` |

## Klassifisering

- **IA / layout:** Growth dashboard som default — **STRUCTURAL_GAP** vs klassisk CMS.  
- **Action hierarchy:** Spredt på save bar, modaler, topbar — **PARTIAL** — ikke footer-primary/entity actions.  
- **Preview/inspector:** Implementert — **PARTIAL** — ikke verifisert visuelt.  
- **Kosmetisk vs blocker:** Uten screenshots — **ikke klassifiser** visuell feil som «blocker»; første prioritet er **IA: content landing**.

**Sluttdom:** **DEGRADED** editor *opplevelse risiko* på grunn av **landing** og **layout-dualitet**; ikke **FULL_PARITY** med Umbraco Bellissima ro.
