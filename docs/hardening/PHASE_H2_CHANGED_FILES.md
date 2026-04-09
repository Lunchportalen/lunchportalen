# PHASE H2 — Changed files

## Kode

| Fil | Hvorfor | Risiko |
|-----|---------|--------|
| `app/api/dev/test-order-status/route.ts` | Blokker dev-only ordre-mutasjon når `VERCEL_ENV=production` — hindrer utilsiktet bruk i prod. | Lav — endrer kun prod-atferd (404); staging/preview/localhost uendret. |
| `app/api/observability/route.ts` | Legger til `cronRecentFailures` for pilot synlighet av cron-feil. | Lav — superadmin-only route; ekstra DB-read. |
| `lib/observability/sli.ts` | Oppdaterer meldinger for outbox SLI slik at de samsvarer med faktisk `cron_runs`-persistens. | Lav — kun tekst/evidence; logikk uendret. |
| `lib/pilot/vercelScheduledCrons.ts` | **Ny** — én kilde for Vercel cron paths (sync med `vercel.json`). | Lav — kun konstanter. |

## Dokumentasjon

- `docs/hardening/H2_API_HARDENING.md`
- `docs/hardening/H2_CRON_WORKER_PILOT_SAFETY.md`
- `docs/hardening/H2_OBSERVABILITY_MINIMUM.md`
- `docs/hardening/H2_RUNBOOK_AND_RECOVERY.md`
- `docs/hardening/H2_PILOT_FINAL_CHECKLIST.md`
- `docs/hardening/H2_VERIFICATION.md`
- `docs/hardening/PHASE_H2_EXECUTION_LOG.md`
- `docs/hardening/PHASE_H2_CHANGED_FILES.md` (denne filen)
- `docs/hardening/PHASE_H2_NEXT_STEPS.md`

## Ikke endret (eksplisitt)

- `middleware.ts`, `order/window`, onboarding, billing engine, employee Week-logikk.
