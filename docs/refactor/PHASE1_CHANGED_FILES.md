# Fase 1 — endrede / nye filer

## Nye

- `lib/week/employeeWeekMenuDays.ts`
- `app/(backoffice)/backoffice/content/_components/workspace/index.ts`
- `app/(backoffice)/backoffice/content/_components/workspace/README.md`
- `tests/lib/weekAvailability.test.ts`
- `docs/refactor/PHASE1_*.md` (denne serien)

## Endret (hovedtrekk)

- `app/api/week/route.ts` — uten Sanity weekPlan; menuContent + avtale
- `app/api/weekplan/route.ts` — deprecation headers + felt
- `app/api/weekplan/next/route.ts` — stub/deprecation
- `app/api/cron/week-visibility/route.ts` — fredag 15:00
- `app/api/cron/week-scheduler/route.ts` — fredag 15:00
- `app/api/cron/lock-weekplans/route.ts` — kommentar
- `app/orders/page.tsx` — employee → `/week`
- `app/min-side/page.tsx` — kommentar (next var allerede `/week`)
- `lib/auth/role.ts` — normalizeRole aliaser; employee kun `/week` i allowNext
- `lib/auth/getAuthContext.ts` — felles normalizeRole
- `lib/week/availability.ts` — fredag 15:00
- `lib/date/oslo.ts` — re-export av ukehjelpere
- `lib/cms/weekPlan.ts` — dokumentasjon
- `lib/sanity/weekplan.ts` — dokumentasjon
- `components/week/WeekMenuReadOnly.tsx` — `/api/week?weekOffset=1`
- `app/(backoffice)/backoffice/content/_components/ContentWorkspaceGlobalHeaderShell.tsx` — employee-faner
- `lib/layout/resolveLayout.ts` — fjernet employee `/orders`-regel
- `studio/schemas/weekPlan.ts`, `studio/src/tools/WeekPlanner.tsx` — 15:00-tekst
- `tests/auth/postLoginRedirectSafety.test.ts` — employee `next=/orders`
- `tsconfig.json` — `@/components/*` prioriterer `src/components/`
