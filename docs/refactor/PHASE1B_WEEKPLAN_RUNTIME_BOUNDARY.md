# Phase 1B — weekPlan (redaksjonelt vs operativ runtime)

## Hovedprinsipp

**Sanity `weekPlan`** er **redaksjonelt / Studio / cron / legacy API** — ikke operativ sannhet for ansatt-bestilling.

**Operativ employee**-uke: `GET /api/week` + `menuContent` / avtale (`company_current_agreement`), se `app/api/week/route.ts` (kommentar + `weekPlanOperational: false` i payload der relevant).

## Kart (konsumenter)

| Område | Rolle | Merknad |
|--------|--------|---------|
| `lib/sanity/weekplan.ts` | Editorial fetch | Sanity GROQ mot `weekPlan` |
| `lib/cms/weekPlan.ts` | Re-export / facade | `@deprecated` for employee runtime |
| `app/api/weekplan/route.ts` | Legacy HTTP | DEPRECATED for nye klienter |
| `app/api/weekplan/next/route.ts` | Legacy HTTP | DEPRECATED; melding om ikke-operativ kilde |
| `app/api/weekplan/publish/route.ts` | Redaksjonell / backoffice | Publisering i Sanity |
| `app/api/cron/lock-weekplans/route.ts` | Cron | Låser Sanity-dokumenter |
| `app/api/cron/week-visibility/route.ts` | Cron | Synlighet (redaksjonell tidsplan) |
| `app/api/cron/week-scheduler/route.ts` | Cron | Kaller interne cron-endepunkter |
| `studio/schemas/weekPlan.ts` | CMS schema | Studio |
| `studio/tools/weekPlanner/WeekPlanner` | Studio tool | Redaksjon |
| `lib/sanity/weekPlanOps.ts` | Sanity ops | Vedlikehold |
| `app/api/order/window/route.ts` | Operativ | **Legacy:** `agreement.weekplan?.tiers` — avtaledata i DB, ikke Sanity `weekPlan`-API for employee UI |
| `app/admin/agreement/page.tsx` | Admin | Viser strukturert `weekPlan` fra **admin API** (firmaavtale) |
| `app/api/admin/agreement/route.ts` | Admin | Bygger `weekPlan` for admin UI |

** ikke** i employee `(app)`-sider: grep `weekplan`/`weekPlan` i `app/(app)` → ingen treff.

## Employee runtime

- **Ingen** employee-side lasting av Sanity `weekPlan` som primær kilde for uke/bestilling etter Phase 1 — `GET /api/week` er kanon.

## Dokumentasjon i repo

- `lib/cms/weekPlan.ts` — header med `deprecated` for employee runtime.
- `lib/sanity/weekplan.ts` — header: redaksjonell, ikke operativ employee-sannhet.
