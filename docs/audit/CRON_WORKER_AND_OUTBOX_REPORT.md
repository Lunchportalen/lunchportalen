# Cron, worker and outbox report (V2)

## Vercel cron (`vercel.json`)

**Scheduled paths (9):**

| Path | Schedule |
|------|----------|
| `/api/cron/week-scheduler` | `*/10 * * * *` |
| `/api/cron/forecast` | `0 2 * * *` |
| `/api/cron/preprod` | `5 8 * * 1-5` |
| `/api/cron/outbox` | `*/2 * * * *` |
| `/api/cron/cleanup-invites` | `30 3 * * *` |
| `/api/cron/esg/daily` | `15 1 * * *` |
| `/api/cron/esg/monthly` | `20 1 1 * *` |
| `/api/cron/esg/yearly` | `25 1 1 1 *` |

**`ignoreCommand`:** ignorerer deploy hvis kun `studio/` endret — **OPS_RISK** (forstå konsekvens ved ren studio-endring).

## Repo cron-ruter (`app/api/cron/**`)

- **56** `route.ts` filer observert under `app/api/cron` ( telling ved audit ).
- **Gap:** Mange flere enn Vercel scheduler — **klassifisering:**
  - **ACTIVE** — kan være manuelt trigget, annen scheduler, eller fremtidig.
  - **DEAD_CODE** / **ORPHAN** — mulig for enkelte «experiment»-navn (`god-mode`, `singularity`, …) — **NEEDS_REVERIFICATION**.

## Outbox

| Komponent | Funn |
|-----------|------|
| `app/api/cron/outbox/route.ts` | **ACTIVE** — scheduled **every 2 min** |
| `workers/worker.ts` | Job type `retry_outbox` → HTTP POST til `/api/cron/outbox` med `CRON_SECRET` / `WORKER_INTERNAL_ORIGIN` |

**Fail-closed:** Worker **skip** hvis env mangler — **OK** mønster.

## Worker (`workers/worker.ts`)

| Job type | Atferd | Klassifisering |
|----------|--------|----------------|
| `retry_outbox` | HTTP til cron outbox | **ACTIVE** |
| `send_email` | `logLine` «stub» | **DEAD_CODE** / **STUB** |
| `ai_generate` | stub | **DEAD_CODE** / **STUB** |
| `experiment_run` | stub | **DEAD_CODE** / **STUB** |

**Idempotens:** Redis `SET NX` på `job:delivered:*` — **CANONICAL**.

## Secrets / ops

| Variabel | Bruk |
|----------|------|
| `CRON_SECRET` | Cron auth (Bearer) |
| `WORKER_INTERNAL_ORIGIN` / `NEXT_PUBLIC_SITE_URL` | Worker → app |
| `QUEUE_CONCURRENCY` | Worker concurrency |

**Risiko:** Manglende env → **stille** skip av outbox-retry — **OPS_RISK** (kø vokser).

## Fail-closed vs fail-open

| Område | Vurdering |
|--------|-----------|
| Worker uten Redis | Fortsetter «proceed» — **fail-open** for idempotens-lag (dokumentert i kode) |
| Outbox uten secret | Skip — **fail-closed** for retry |

## Konklusjon

- **Pilot:** Verifiser at **kun** intenderte cron-paths er eksponert og auth-beskyttet.  
- **Worker:** **Stub**-jobber er **STILL_OPEN_FROM_BASELINE** produksjonsmessig.
