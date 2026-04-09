# LIVE READY — Runbook (bred live)

**Dato:** 2026-03-29  
**Bygger på:** `docs/hardening/H2_RUNBOOK_AND_RECOVERY.md` — utvidet med **bred live**-perspektiv.

## Deploy

1. RC-commit med grønn `build:enterprise` + tester.  
2. Vercel deploy til produksjon.  
3. Verifiser miljøvariabler (secrets nedenfor).

## Rollback

- Vercel: forrige deployment / Git SHA.  
- DB: migrasjoner reverseres **ikke** automatisk — plan eies av tech.

## Secrets (minimum bred live)

| Variabel | Formål |
|----------|--------|
| `CRON_SECRET` | Scheduled crons + worker outbox |
| `SYSTEM_MOTOR_SECRET` | Der system/AI-cron krever det |
| Supabase URL/keys | Auth + data |

## Cron health

- `GET /api/observability` (superadmin): `cronRecentFailures` — feil synlige.  
- `cron_runs` tabell — sannhet for kjøring.

## Kjente stubs

- Worker: e-post, AI, experiment — **ikke** produksjons-SLA.

## Backup

- Supabase PITR/snapshot — eier må bekrefte plan.

## Relatert

- `LIVE_READY_SUPPORT_MODEL.md`
