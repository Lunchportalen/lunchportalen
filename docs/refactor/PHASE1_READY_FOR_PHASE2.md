# Phase 1 — Klar for Fase 2? (sjekkliste)

| Krav | Ja/nei | Merknad |
|------|--------|---------|
| Employee kun `/week` bevist | **Ja** | Layout-guard + tester som importerer `enforceEmployeeWeekOnlyOnAppShell`, `app/orders`, `app/min-side`; se `PHASE1C_EMPLOYEE_DIRECT_ROUTE_PROOF.md` |
| weekPlan uten operativ employee-autoritet | **Ja** | Uendret fra 1B: `GET /api/week` + kommentarer; `PHASE1B_WEEKPLAN_RUNTIME_BOUNDARY.md` |
| Fredag 15:00 enhetlig | **Ja** | `week-visibility` bruker `isFri1500` (rettet i 1B); konsistent med ukeslutt-regler i øvrig kodebase |
| Canonical role normalization på plass | **Ja** | `lib/auth/role.ts` — utvidet i 1B; `lib/auth/roles.ts` delegerer |
| `src/components` canonical nok for videre migrering | **Delvis** | Nav + PageSection + WeekMenuReadOnly + HeaderShell; resten av `components/` gjenstår |
| ContentWorkspace delt nok til trygg videreutvikling | **Delvis** | `ContentWorkspaceFinalComposition` (1B) + `ContentWorkspaceEditorMountRouter` (1C); stor state-blokk gjenstår |
| `build:enterprise` grønn | **Ja** | Med innebygd `NODE_OPTIONS=8192`; verifisert lokal kjøring exit 0 |
| Blockers før Fase 2 | Se nedenfor | |

## Blockers (lav / moderate)

1. **ESLint warnings** i stor skala — bør ryddes iterativt, ikke som én Fase 2-forudsætning.
2. **Full test-suite + lint** som én gate bør kjøres i CI før store Fase 2-endringer (allerede i `ci:enterprise`).

## Anbefaling

Repoet er **klar til å starte Fase 2** for arbeid som ikke krever full komponent-migrering eller full ContentWorkspace-oppdeling først; behold små, isolerte PR-er.
