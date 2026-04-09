# H2 — Pilot final checklist (brutal)

Kryss av før pilot-golive. **Nei** = ikke fly.

## Access / security

- [ ] `CRON_SECRET` satt i prod + matcher Vercel cron headers  
- [ ] `SYSTEM_MOTOR_SECRET` satt der superadmin/system forventer det (sjekk `/superadmin/system`)  
- [ ] Ingen forventning om at middleware **validerer rolle** — API/layout har eget ansvar  
- [ ] `POST /api/dev/test-order-status` returnerer **404** i Vercel production (H2)  

## Cron / worker

- [ ] `lib/pilot/vercelScheduledCrons.ts` matcher `vercel.json`  
- [ ] Outbox cron kjører (rader i `cron_runs`, eller tom `cronRecentFailures` etter fiks)  
- [ ] Worker-stubs (`send_email`, `ai_generate`, `experiment_run`) **akseptert** som ikke-prod eller avstengt  

## Publishing (CMS)

- [ ] Publish-flyt testet for **én** kritisk side (staging)  
- [ ] Preview vs published forstått av pilot-team  

## Social

- [ ] Alle forstår: ekstern publisering kan være **dry_run** / stub  
- [ ] `POST /api/social/posts/publish` respons lest (ikke bare 200)  

## SEO

- [ ] `build:enterprise` grønn (inkl. SEO-skript) siste deploy  
- [ ] Ingen «metadata er live» uten publish — prosess avklart  

## ESG

- [ ] Tom data ≠ «grønt» — copy/markedsføring avklart  
- [ ] Riktig APIflate brukt: **admin** vs **backoffice** vs **superadmin** etter rolle  

## Backup / restore

- [ ] Supabase backup / PITR kjent for pilot-miljø  
- [ ] Ingen illusjon om app-innebygd full restore  

## Support readiness

- [ ] Runbook lest: `H2_RUNBOOK_AND_RECOVERY.md`  
- [ ] Eskalering: hvem ringer når `cronRecentFailures` fylles  

## Known limitations (akseptert)

- [ ] `strict: false`  
- [ ] APIflate stor — ikke alle ruter manuelt revidert  
- [ ] Worker delvis stub  
- [ ] Ingen ekstern paging (Slack/PagerDuty) i H2  
