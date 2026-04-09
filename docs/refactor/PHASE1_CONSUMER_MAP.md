# Fase 1 — consumer map (bevis)

**Dato:** 2026-03-28

## `/api/week`

| Consumer | Bruk |
|----------|------|
| `app/today/WeekPreview.tsx` | `fetch('/api/week?weekOffset=…')` — dager, range, publisering |
| `app/today/NextWeekOrderClient.tsx` | Samme + parallell `order/window` |
| `components/week/WeekMenuReadOnly.tsx` | `weekOffset=1` — neste uke meny |

## `/api/weekplan`

| Consumer | Merknad |
|----------|---------|
| `tests/api/smoke-api-routes.test.ts` | Røyk; cookies i vitest |
| Ingen produksjons-UI etter Fase 1 | Deprecation-header |

## `/api/weekplan/next`

| Consumer | Etter Fase 1 |
|----------|--------------|
| Tidligere `WeekMenuReadOnly` | Byttet til `/api/week?weekOffset=1` |
| Tester | Stub returnerer `plan: null` |

## `fetchNextPublishedWeekPlan` / `fetchCurrentWeekPlan` / `fetchNextOpenWeekPlan`

| Consumer | Status |
|----------|--------|
| `app/api/weekplan/route.ts` | Fortsatt i bruk (deprecated route) |
| `app/api/weekplan/publish/route.ts` | Studio/publisering — behold |
| `app/api/week/route.ts` | **Fjernet** — ikke lenger importert |

## `menuContent`

| Consumer | Rolle |
|----------|--------|
| `app/api/week/route.ts` | `getMenuForDates` → dag-rader |
| `app/api/cron/week-visibility/route.ts` | Synlighet batch |
| `app/api/order/window/route.ts` | `getMenusByMealTypes` m.m. |

## `agreement_json` / `currentAgreement`

| Consumer | Rolle |
|----------|--------|
| `app/api/order/window/route.ts` | `meal_contract`, legacy `weekplan` i avtale-JSON |
| `lib/agreement/currentAgreement.ts` | Operativ avtalestate |
| `app/api/weekplan/route.ts` | Leser `agreement_json` (deprecated route) |

## `EmployeeWeekClient`

- Bruker **`/api/order/window`** (ikke `/api/week`) — kontrakt uendret i Fase 1.
