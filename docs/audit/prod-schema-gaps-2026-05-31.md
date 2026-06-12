# Prod schema gaps — parkert (2026-05-31)

Read-only triage (Stage 3-T / 4). **Ikke materialisert på prod** uten eksplisitt deploy-beslutning.
Harness: `scripts/ci/db-rebuild-verify.mjs` — mangler her → **EXPECTED-RED** (ikke REGRESSION-RED).

## Billing / rollup

| Tabell | Prod | Kallested | Status |
|--------|------|-----------|--------|
| `daily_company_rollup` | mangler | `app/api/superadmin/invoices/reconcile/route.ts` | Parkert — reconcile avhenger av feature-liveness |
| `daily_employee_orders` | mangler | `lib/kitchen/ordersFeed.ts` (kun `/api/kitchen/orders`) | **Optimalisering** — se `docs/audit/kitchen-daily-employee-orders-2026-05-31.md` |
| `invoice_exports` | mangler | kun `lib/types/database.ts` | Parkert — erstattet av `tripletex_exports` |
| `esg_monthly` | mangler | ingen runtime (droppet K4) | Parkert — bevisst fjernet |

## CMS / backoffice

| Objekt | Prod | Kallested | Status |
|--------|------|-----------|--------|
| `content_health` | **view** (`relkind=v`) | CMS — ikke kitchen/driver | Harness sjekker kun `pg_tables`; ikke REGRESSION |

| Tabell | Prod | Kallested | Status |
|--------|------|-----------|--------|
| `content_releases` | mangler | `lib/backoffice/content/releasesRepo.ts`, scheduler | Parkert |
| `content_release_items` | mangler | `releasesRepo.ts` | Parkert |
| `content_workflow_state` | mangler | `lib/backoffice/content/workflowRepo.ts` | Parkert |
| `content_audit_log` | mangler | `app/api/backoffice/content/audit-log` | Parkert (degraded empty) |
| `content_analytics_events` | mangler | `app/api/public/analytics`, POS/MOO libs | Parkert |
| `content_experiments` | mangler | `lib/backoffice/experiments/experimentsRepo.ts` | Parkert |

## A/B og eksperimenter

| Tabell | Prod | Kallested | Status |
|--------|------|-----------|--------|
| `ab_experiments` | mangler | `lib/growth/abAssign.ts`, cron experiments | Parkert |
| `ab_variants` | mangler | samme | Parkert |
| `experiment_results` | mangler | `lib/ai/experiments/analytics.ts`, backoffice API | Parkert |

## Stale type-liste (aldri prod-sannhet)

| Tabell | Prod | Kallested | Status |
|--------|------|-----------|--------|
| `entities` | mangler | `lib/types/database.ts` | Parkert |
| `entity_relations` | mangler | `lib/types/database.ts` | Parkert |

## Integritet (ikke kitchen/driver scope)

| Objekt | Prod | Kallested | Status |
|--------|------|-----------|--------|
| `company_deletions_mode_ck` | mangler | `company_deletions` + `tests/db/database-integrity.test.ts` | EXPECTED-RED — forward integritet, egen go |
| `profiles_company_idx` | **finnes** | baseline | Harness A-fix (var `profiles_company_id_idx`) |

## Kitchen + driver (Stage 4)

Operativ kjøkken/sjåfør bruker **`orders`**, **`day_choices`**, **`kitchen_batches`**, **`companies`**, **`company_locations`**, **`profiles`** — alle på prod.
Valgfritt: `production_operative_snapshots` (degrades til live), `daily_employee_orders` (optimalisering for feed-API).
