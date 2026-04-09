# H1 — Pilot readiness-pakke

**Bruk:** Kryss av før pilot / begrenset live. H1 legger til **sikkerhetslås** på demo-rute `/api/something`; øvrige punkter arver fra `GO_LIVE_READINESS_CHECKLIST.md` (H0).

---

## Access & security

- [ ] `/api/something` kun brukt med **superadmin** eller **cron-secret** (etter H1) — ingen anonym POST.  
- [ ] Stikkprøve: `admin` / `superadmin` / `backoffice` API uten cookie → 401/403.  
- [ ] `CRON_SECRET` satt i produksjon.

---

## Billing safety

- [ ] Uendret fra H0 — faktura-cron og webhooks verifisert i staging.

---

## Content / publish safety

- [ ] Publisering kun via godkjent CMS-workflow — røyktest.

---

## Social publish safety

- [ ] Kanalpolicy forstått (stub / ikke aktivert) — dokumentert til innholdsteam.

---

## SEO publish safety

- [ ] SEO-endringer krever eksplisitt lagring — ikke auto-live uten publish.

---

## ESG truthfulness

- [ ] Kun snapshot-baserte tall i kunde-relatert materiell — tom data ≠ «grønt».

---

## Cron / worker safety

- [ ] Outbox-retry overvåket; worker-stubs **ikke** brukt som produksjonsløfter for e-post/AI.

---

## Monitoring & alerting

- [ ] Minst én alert (5xx eller cron silence) — eier navngitt.

---

## Backup / restore

- [ ] Supabase backup-policy kjent — se H0.

---

## Support runbook

- [ ] Inkluder: «Ved 401 på intern smoke: bruk superadmin eller cron-secret for `/api/something` om nødvendig.»

---

## Gate

| Krav | Status |
|------|--------|
| `npm run typecheck` | Grønn på RC |
| `npm run build:enterprise` | Grønn på RC |
