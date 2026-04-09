# PHASE H2 — Execution log

**Fase:** Pilot hardening (H2)  
**Dato start/slutt:** 2026-03-29

## Mål (fra brief)

1. Lukke viktigste **konkrete** pilot-risikoer fra H0/H1/FULL_REPO_AUDIT_V2.  
2. Pilot-scope **tydelig** og **fail-closed** der mulig uten stor refaktor.  
3. **Ikke** nye features, ikke parallelle systemer, ikke brede refaktorer.

## Utført arbeid

| # | Beskrivelse |
|---|-------------|
| 1 | Kartlagt eksisterende API/cron-mønstre (`scopeOr401`, `requireCronAuth`). |
| 2 | **Fail-closed:** `POST /api/dev/test-order-status` blokkert når `VERCEL_ENV=production`. |
| 3 | **Observability:** `GET /api/observability` utvidet med `cronRecentFailures` (siste 20 `cron_runs` med `status=error`). |
| 4 | **Konstant:** `lib/pilot/vercelScheduledCrons.ts` speiler `vercel.json` crons. |
| 5 | **SLI-tekst:** `lib/observability/sli.ts` — fjernet foreldet påstand om at outbox ikke persisterer til `cron_runs`. |
| 6 | Dokumentasjon: `H2_*.md`, `PHASE_H2_*.md`. |

## Ikke utført (bevisst)

- Full pass på alle ~561 API-ruter.  
- Middleware rolle-sjekk.  
- `strict: true`.  
- Deaktivering av alle ikke-Vercel crons (ville kreve produkt/business-vedtak).  

## Verifikasjon

Se `H2_VERIFICATION.md` for kommandoer og resultat.
