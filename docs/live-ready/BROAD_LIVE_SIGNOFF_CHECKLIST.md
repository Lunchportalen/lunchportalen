# Bred live — signoff-sjekkliste

**Dato:** 2026-03-29  
Kort og brutal — alt skal være **JA** før full bred trafikk.

- [ ] **Secrets** verifisert i målmiljø (inkl. `SYSTEM_MOTOR_SECRET`, relevante cron- og integrasjonsnøkler)
- [ ] **Cron** verifisert: `vercel.json` ↔ faktisk Vercel-schedule ↔ `lib/pilot/vercelScheduledCrons.ts`
- [ ] **Worker-posture** verifisert: forstått at kun deler er LIVE; stubs ikke forretningskritiske
- [ ] **Backup**-prosedyre lest og eier bekrefter Supabase/leverandør-rutine
- [ ] **Rollback** forstått (deploy-revert + ev. data — se runbook)
- [ ] **Support owner** definert (navn + eskalering)
- [ ] **Known limitations** lest og akseptert (`BROAD_LIVE_KNOWN_LIMITATIONS.md`)
- [ ] **Broad live scope** godkjent (`LIVE_READY_SCOPE_LOCK.md`)
- [ ] **Social publish**-forventning godkjent (dry-run / nøkler OK å kommunisere)
- [ ] **SEO publish**-forventning godkjent (review-first)
- [ ] **ESG** ordlyd/ærlighet godkjent (ingen greenwashing)
- [ ] **Admin/superadmin** tilgang gjennomgått (minimalt antall superadmin)
- [ ] **Employee /week** røyktestet på målrettet miljø
- [ ] **Build grønn**: `npm run build:enterprise`
- [ ] **Tester grønn**: `npm run test:run`
