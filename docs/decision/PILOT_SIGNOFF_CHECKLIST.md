# Pilot signoff checklist (brutal — G0)

**Dato:** 2026-03-29  
Kryss **[x]** kun med **navn + dato i marg** eller vedlagt sporbarhet.

## Tekniske gates (automatiserbare)

- [ ] `npm run typecheck` grønn på RC-commit (siste verifisert: **2026-03-29** ✅)
- [ ] `npm run build:enterprise` grønn — inkl. SEO-skript (siste verifisert: **2026-03-29** ✅)
- [ ] `npm run test:run` grønn — full suite (siste verifisert: **2026-03-29** ✅ — 212 filer / 1191 tester)

## Secrets & miljø

- [ ] `CRON_SECRET` satt og verifisert mot faktisk cron-kall i **pilot-miljø**
- [ ] `SYSTEM_MOTOR_SECRET` der superadmin/system krever det — **WARN/FAIL** forstått
- [ ] Supabase service keys — ikke i klientbundle (stikkprøve)

## Cron & worker

- [ ] `lib/pilot/vercelScheduledCrons.ts` ≡ `vercel.json`
- [ ] `cron_runs` får forventede rader etter schedule (outbox m.m.)
- [ ] Worker-stub akseptert skriftlig eller ikke i bruk for pilot

## Backup & rollback

- [ ] Supabase backup/PITR policy **kjent** og eier navngitt
- [ ] Vercel rollback (forrige deployment) demonstrert eller dokumentert for operatør

## Support & scope

- [ ] Support-kontakt og eskalering definert
- [ ] `PILOT_SCOPE_LOCK.md` lest og **godkjent** av produkteier
- [ ] `PILOT_KNOWN_LIMITATIONS_ACCEPTANCE.md` signert der påkrevd

## Flate-spesifikt (manuell / stikkprøve)

- [ ] **Social publish expectation** — team forstår dry_run/stub
- [ ] **SEO publish expectation** — ikke «live meta» uten publish-disiplin
- [ ] **ESG wording** — ikke selg tom data som suksess
- [ ] **Admin/superadmin** — hvem har tilgang i pilot; minimer superadmin
- [ ] **Employee /week** — røyktest på pilot-tenant (uke, fredag 15:00 logikk der relevant)

## Kjente begrensninger

- [ ] `strict: false` akseptert
- [ ] Middleware uten rolle forstått — API/layout er sannhet

## Avsluttende

- [ ] `GO_NO_GO_PILOT_DECISION.md` lest — beslutning **GO WITH CONDITIONS** forstått
- [ ] Ingen åpen **P0** mot kjerneflyt uten dokumentert unntak

**Uten alle obligatoriske kryss:** ikke start pilot — eller nedklasser scope skriftlig.
