# E0 — Cron / worker closure (arbeidsstrøm 2)

**Dato:** 2026-03-29

## Cron (Vercel-relevant)

Synk: `vercel.json` ↔ `lib/pilot/vercelScheduledCrons.ts`.  
Klassifisering: **LIVE** med `CRON_SECRET` / dokumenterte secrets per rute — jf. `docs/live-ready/LIVE_READY_CRON_WORKER_STATUS.md`.

## Worker (`workers/worker.ts`)

| Job type | Status | Enterprise-live? |
|----------|--------|-------------------|
| `retry_outbox` | **LIVE** (HTTP til `/api/cron/outbox`) | Ja, med Redis + secrets |
| `send_email` | **STUB** (`send_email_stub`) | **Nei** |
| `ai_generate` | **STUB** | **Nei** |
| `experiment_run` | **STUB** | **Nei** |

## Konklusjon

Stub-jobber er **eksplisitt ikke-produksjonsleveranser** i kode. Dette er **uforenlig** med påstand om ubetinget enterprise-live for plattformen som helhet — med mindre enterprise-scope **ekskluderer** disse jobbene formelt og ingen kunde forventer dem (fortsatt NO-GO for «hele systemet enterprise-live»).

## Endringer i E0

- Ingen kodeendring — sannhet dokumentert.
