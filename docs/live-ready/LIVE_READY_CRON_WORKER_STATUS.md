# LIVE READY — Cron / worker status (arbeidsstrøm 2)

**Dato:** 2026-03-29

## Vercel — «bred live relevant» (LIVE)

Synk: `vercel.json` ↔ `lib/pilot/vercelScheduledCrons.ts`

| Path | Status |
|------|--------|
| `/api/cron/week-scheduler` | **LIVE** |
| `/api/cron/forecast` | **LIVE** |
| `/api/cron/preprod` | **LIVE** |
| `/api/cron/outbox` | **LIVE** |
| `/api/cron/cleanup-invites` | **LIVE** |
| `/api/cron/esg/daily` | **LIVE** |
| `/api/cron/esg/monthly` | **LIVE** |
| `/api/cron/esg/yearly` | **LIVE** |

Alle stikkprøver: **`requireCronAuth`** (unntak der egen motor-secret er dokumentert i fil).

## Øvrige `app/api/cron/*`

- **INTERNAL_ONLY** / **PILOT_ONLY** avhengig av operasjon — mange er **ikke** på Vercel schedule.
- **Ikke** deaktivert i kode i denne fasen (ville kreve produktvedtak).

## Worker (`workers/worker.ts`)

| Job | Status |
|-----|--------|
| `retry_outbox` | **LIVE** (krever Redis + secrets) |
| `send_email` | **STUB** — ikke SLA for bred live |
| `ai_generate` | **STUB** |
| `experiment_run` | **STUB** |

## Secrets (minimum)

- `CRON_SECRET`, `WORKER_INTERNAL_ORIGIN` for outbox-retry.
- `SYSTEM_MOTOR_SECRET` der AI/cron-filer krever det.

## Endringer i denne fasen

- Ingen kodeendring — status dokumentert.
