# Fase 1 — beslutninger

**Dato:** 2026-03-28

## Week — operativ sannhet

- **Kilde:** `company_current_agreement` + `menuContent` (Sanity) + `lib/week/availability.ts` + `app/api/order/window/route.ts` + `lib/agreement/currentAgreement.ts`.
- **GET `/api/week`** bygger dager uten Sanity `weekPlan`; `plan` er alltid `null`; `sanity.weekPlanOperational: false`.
- **Sanity `weekPlan`** er **redaksjonelt** (Studio, `lock-weekplans`, ev. eldre verktøy), ikke employee-runtime.

## Kanonisk komponentrot

- **`src/components/`** løses først i `tsconfig.json` (`@/components/*`).
- **`components/`** er overgang (eksisterende ~240 filer); ikke slettet i Fase 1.

## Kanonisk rolle-normalisering

- **`lib/auth/role.ts`** `normalizeRole()` — inkl. aliaser `companyadmin`, `admin`, `kjokken`, `sjafor`.
- **`lib/auth/getAuthContext.ts`** bruker samme `normalizeRole` (ingen lokal duplikat).

## Employee frontendflate

- **`allowNextForRole`:** employee kun `next` som starter med `/week`.
- **`/orders`:** server redirect til `/week` for employee; innlogging `next=/week`.
- **`/min-side`:** uendret redirect-atferd; post-login kan ikke bruke `next=/orders` for employee.

## Fredag 15:00

- **`lib/week/availability.ts`:** `isAfterFriday1500` (alias `isAfterFriday1400` beholdt for bakoverkompatibilitet).
- **Cron:** `week-visibility` (fredag 15:00), `week-scheduler` (fredag 15, 10-min vindu).
- **Studio:** `weekPlan`-felttekst og WeekPlanner-hjelpetekst oppdatert til 15:00.

## Deprecate

| Område | Status |
|--------|--------|
| `GET /api/weekplan` | `Deprecation` header + `successor`, `deprecated: true` i payload |
| `GET /api/weekplan/next` | Stub med `plan: null`, `deprecated: true`, peker til `/api/week?weekOffset=1` |
| `lib/cms/weekPlan.ts` | Kommentar: ikke employee-operativ kilde |
| `fetchNextPublishedWeekPlan` | Fortsatt eksportert (alias); dokumentert som ikke-operativ for employee |

## Beholdt (hvorfor)

| Fil | Grunn |
|-----|--------|
| `app/api/order/window/route.ts` | Kanonisk bestillingsvindu; uendret kontrakt for `EmployeeWeekClient` |
| `lib/sanity/weekplan.ts` | Studio/cron/redaksjonell data |
| `app/api/cron/lock-weekplans/route.ts` | Låser redaksjonelle `weekPlan`-dokumenter |
| `middleware.ts` | Kun cookie-gate; rolle finnes i layouts/API |

## ContentWorkspace

- Ny mappe `content/_components/workspace/` med re-exports (`ContentWorkspaceShell`, `ContentTreePane`, …) + `README.md` — struktur uten atferdsendring.
