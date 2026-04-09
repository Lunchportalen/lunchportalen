# Fase 1 — utførelseslogg

**Dato:** 2026-03-28  
**Status:** Fullført (kode + dokumentasjon + målrettede tester).

## Utført

1. **Week API:** `GET /api/week` uten GROQ `weekPlan`; dager fra `weekRangeISO` + `getMenuForDates` + `buildEmployeeWeekDayRows`.
2. **Auth:** `normalizeRole` samlet i `lib/auth/role.ts`; `getAuthContext` importerer.
3. **Employee surface:** `allowNextForRole` employee → kun `/week`; `orders` redirect for employee; post-login test for `next=/orders`.
4. **Tid:** Fredag 15:00 i `availability`, cron og relevante Studio-tekster; re-export fra `lib/date/oslo.ts`.
5. **Komponenter:** `tsconfig` — `src/components` først for `@/components/*`.
6. **ContentWorkspace:** `workspace/index.ts` re-exports + README (modulnavn).
7. **Deprecate:** `/api/weekplan`, `/api/weekplan/next` markert; `weekPlan`-CMS dokumentert som ikke-operativ for employee.
8. **Tester:** `tests/lib/weekAvailability.test.ts` (4 scenarioer).

## Ikke gjort (bevisst / senere)

- Fysisk flytting av alle filer fra `components/` til `src/components/` (for stor PR).
- Sletting av `weekPlan` i Sanity eller fjerning av `lock-weekplans` (krever data-eier).
- Endring av `middleware.ts` rollelogikk (frozen; kant forblir cookie-only).

## Verifikasjon

- `npx vitest run tests/lib/weekAvailability.test.ts tests/auth/postLoginRedirectSafety.test.ts` — grønn.
- `npm run typecheck` — kjør lokalt ved release (lang kjøretid i CI).
