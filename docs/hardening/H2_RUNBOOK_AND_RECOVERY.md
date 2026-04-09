# H2 — Pilot runbook og recovery

**Dato:** 2026-03-29  
**Mål:** Kort, operativ sannhet for pilot — ikke full SOC2-runbook.

## Deploy

| Steg | Beskrivelse |
|------|-------------|
| 1 | Merge til deploy-branch (typisk `main` / avtalt pilot-branch). |
| 2 | Vercel (eller valgt host) bygger med `npm run build:enterprise` i CI / produksjons pipeline. |
| 3 | Verifiser at **miljøvariabler** er satt (se nedenfor). |
| 4 | Etter deploy: sjekk `/api/health/live` eller tilsvarende health-endepunkt + superadmin `/superadmin/system` etter behov. |

## Rollback

| Steg | Beskrivelse |
|------|-------------|
| 1 | Vercel: **Promote previous deployment** eller redeploy forrige Git SHA. |
| 2 | Supabase-migrasjoner: rollback er **ikke** automatisk — planlegg egen DB-strategi ved skjemaendring. |

## Backup / restore

| Område | Sannhet |
|--------|---------|
| **Database** | Supabase — bruk leverandørens **backup / PITR** (avhengig av plan). **Ingen** app-innebygd full restore-knapp dokumentert her. |
| **Media** | Backoffice media i DB + lagring — følg Supabase storage / bucket policy. |

**Mangler:** Egen «one-click restore»-prosedyre i repo — merk som **GAP** for bred live.

## Cron / secrets check (før go-live window)

| Sjekk | Kommando / sted |
|-------|-----------------|
| `CRON_SECRET` satt | Vercel env + worker |
| `cron_runs` får rader | Etter scheduled kjøring — `GET /api/observability` (`cronRecentFailures` tom etter suksess) |
| Outbox | `POST /api/cron/outbox` manuelt med Bearer (kun dev/staging) eller vent på schedule |

Referanse: `lib/pilot/vercelScheduledCrons.ts` for forventede paths.

## Kjente stubs (må aksepteres eller fikses senere)

| Komponent | Stub |
|-----------|------|
| Worker | `send_email`, `ai_generate`, `experiment_run` |
| Social | Meta Graph — **dry_run** inntil nøkler |
| Se | `H2_CRON_WORKER_PILOT_SAFETY.md` |

## Eskalering (support)

| Nivå | Handling |
|------|----------|
| L1 | Sjekk `GET /api/observability` (superadmin), Vercel logs, `cron_runs`. |
| L2 | Supabase dashboard (queries, RLS-feil), Redis (hvis brukt). |
| L3 | Utvikler — incident etter intern mal (`INCIDENT_RESPONSE_PLAN.md` i rot hvis aktuelt). |

## Relaterte dokumenter

- `docs/hardening/GO_LIVE_READINESS_CHECKLIST.md`
- `docs/hardening/H2_PILOT_FINAL_CHECKLIST.md`
