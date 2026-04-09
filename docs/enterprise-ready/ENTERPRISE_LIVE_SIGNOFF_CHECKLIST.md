# E0 — Enterprise live signoff (ubetinget)

**Dato:** 2026-03-29  
**For ubetinget GO:** alt nedenfor må være **JA**. E0-status: **flere NEI** → **NO-GO**.

- [ ] **Secrets** verifisert i produksjon
- [ ] **Cron** verifisert (schedule ↔ kode)
- [ ] **Worker:** ingen **STUB** igjen for funksjoner som markedsføres som live — eller eksplisitt fjernet fra produkt
- [ ] **Backup** verifisert (restore-test)
- [ ] **Rollback** øvd/verifisert
- [ ] **Support owner** + eskalering definert og testet
- [ ] **Limitations** i `ENTERPRISE_LIVE_LIMITATIONS.md` **alle lukket** (ingen gjenstående «Nei»)
- [ ] **Broad live scope** godkjent uten skjulte vilkår
- [ ] **Social publish** runtime = forventning (ingen DRY_RUN der «live» loves)
- [ ] **SEO publish** runtime = forventning
- [ ] **ESG** ordlyd godkjent (ingen greenwashing)
- [ ] **Admin/superadmin** tilgang minimert og revidert
- [ ] **Employee /week** røyktestet
- [ ] **Build grønn** (`npm run build:enterprise`)
- [ ] **Tester grønne** (`npm run test:run`)
- [ ] **Ingen blocker merket RED** i `ENTERPRISE_LIVE_TRAFFIC_LIGHT_MATRIX.md`

**E0 2026-03-29:** Sjekklisten er **ikke** oppfylt → **NO-GO**.
