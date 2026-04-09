# H2 — Cron / worker pilot safety

**Dato:** 2026-03-29

## Vercel-scheduled crons (pilot «sannhet»)

Én kilde i kode: `lib/pilot/vercelScheduledCrons.ts` — **må** oppdateres hvis `vercel.json` endres.

| Path | Schedule (fra `vercel.json`) |
|------|------------------------------|
| `/api/cron/week-scheduler` | `*/10 * * * *` |
| `/api/cron/forecast` | `0 2 * * *` |
| `/api/cron/preprod` | `5 8 * * 1-5` |
| `/api/cron/outbox` | `*/2 * * * *` |
| `/api/cron/cleanup-invites` | `30 3 * * *` |
| `/api/cron/esg/daily` | `15 1 * * *` |
| `/api/cron/esg/monthly` | `20 1 1 * *` |
| `/api/cron/esg/yearly` | `25 1 1 1 *` |

## Andre cron-ruter i repo

- **56+** `app/api/cron/**/route.ts` finnes — **alle** stikkprøver bruker `requireCronAuth` (Bearer / `x-cron-secret`).
- **Ikke** alle er på Vercel-schedule → kan være manuelle/legacy — **ikke** deaktivert i H2 (unntak: allerede auth-beskyttet).

## Worker (`workers/worker.ts`)

| Jobbtype | Status | Merknad |
|----------|--------|---------|
| `retry_outbox` | **Aktiv** | HTTP POST til `/api/cron/outbox` med `CRON_SECRET`; krever `WORKER_INTERNAL_ORIGIN` / site URL. |
| `send_email` | **Stub** | Logger kun — **ikke** produksjons e-post. |
| `ai_generate` | **Stub** | Logger kun. |
| `experiment_run` | **Stub** | Logger kun. |

## Secrets (pilot)

| Variabel | Bruk |
|----------|------|
| `CRON_SECRET` | Vercel cron + worker → outbox |
| `SYSTEM_MOTOR_SECRET` | Noen AI/cron-ruter (se enkeltfiler) |
| `WORKER_INTERNAL_ORIGIN` | Worker → app (outbox retry) |
| `REDIS_URL` / tilsvarende | Valgfri Redis for kø-idempotens |

## Fail-closed

- `requireCronAuth`: manglende secret → **500** `cron_secret_missing`; ugyldig secret → **403**.
- Outbox: feil ved prosessering → `cron_runs` med `status=error` (best effort).

## Kodeendringer (H2)

- `lib/pilot/vercelScheduledCrons.ts` — **ny** konstantliste.
- `lib/observability/sli.ts` — oppdatert tekst for outbox SLI (fjernet foreldet «persisterer ikke»).
