# Go-live readiness — sjekkliste (pilot / begrenset live)

**Bruk:** Kryss av med ansvarlig og dato. «N/A» kun med begrunnelse.  
**Prinsipp:** Ingen punkt antas grønt uten **bevis** (logg, testnotat, skjermbilde av health, osv.).

---

## 1. Access & security

- [ ] Alle beskyttede ruter har **server-side** gate (layout eller API) — stikkprøve på employee, admin, superadmin, kitchen, driver, backoffice.
- [ ] `allowNextForRole` og post-login **testet** mot representative `next`-URLer (inkl. avviste stier).
- [ ] **Cron / interne** ruter krever `CRON_SECRET` (eller tilsvarende) — verifisert i staging.
- [ ] **Ingen** hemmeligheter i klientbundle — stikkprøve med `grep`/build output policy.

---

## 2. Billing & invoicing safety

- [ ] Fakturacron og Tripletex/eksport **kjørt i test** med testdata — ingen uventet dobbeltfakturering.
- [ ] `billing_hold` og manuelle stopp testet der relevant.
- [ ] Webhook (Stripe) **signatur** og feilhåndtering verifisert.

---

## 3. Content & publish safety

- [ ] Publisering av innhold går kun via **godkjent** workflow (draft → publish) — stikkprøve i CMS.
- [ ] Ingen automatisk publish fra SEO/AI uten eksplisitt lagring — **prosess** bekreftet.
- [ ] Rollback / versjonshistorikk der det er lovet — røyktest.

---

## 4. Social publish safety

- [ ] Statusmodell for `social_posts` forstått (planned vs faktisk publisert eksternt).
- [ ] Kanalpolicy (stub / `CHANNEL_NOT_ENABLED`) **kommunisert** til innholdsteam.
- [ ] Ingen «published» i DB uten faktisk ekstern post der det er krav — verifisert mot executor.

---

## 5. SEO publish safety

- [ ] SEO-endringer i CMS reflekteres først etter **lagring** + normal publish-pipeline — demonstrert.
- [ ] `build:enterprise` SEO-skript **grønne** i release-kandidat.

---

## 6. ESG truthfulness

- [ ] ESG-tall i presentasjoner/markedsføring **matcher** eksporterbare snapshots eller er merket som ikke-datadrevet.
- [ ] Tom ESG-data **ikke** solgt som positivt utfall — avklart med salg/support.

---

## 7. Cron / worker / retry safety

- [ ] Kritiske croner dokumentert med forventet frekvens og **alert** ved manglende kjøring.
- [ ] Outbox/retry (`/api/cron/outbox`, worker `retry_outbox`) testet i staging med feilsimulering.
- [ ] ESG-bygg (`esg_build_*`) — sjekk siste vellykkede kjøring i prod-lignende miljø.

---

## 8. Monitoring & alerting

- [ ] `/superadmin/system` (eller tilsvarende) viser **NORMAL** / forventet WARN der avtalt.
- [ ] Loggaggregat eller minimum **error rate**-innsikt for Next — ikke kun `console` i Vercel.
- [ ] P1-hendelser (betaling, auth, ordre-kritisk) har **on-call-kjede** (selv om enkel).

---

## 9. Backup / restore

- [ ] Supabase backup-policy **kjent** (PITR eller daglig snapshot) og eier navngitt.
- [ ] **Restore-test** på ikke-prod minst én gang før pilot (eller dokumentert risiko).

---

## 10. Pilot rollout

- [ ] **Pilot-tenant** utvalgt med skriftlig avtale om begrensninger og support.
- [ ] **Rollback-plan** (feature flags, deploy revert, disable cron) dokumentert én side.
- [ ] Brukerkommunikasjon: kjente begrensninger (f.eks. SoMe-kanal, ESG-data).

---

## 11. Support runbook

- [ ] «Hva gjør support ved…» — login loop, manglende ordre, feil ukevisning, tom ESG — **1 sider per topp-tema**.
- [ ] Eskalering til utvikling med **RID** / request-id fra API der tilgjengelig.

---

## Avsluttende gate

| Gate | Krav |
|------|------|
| CI / release | `npm run typecheck` + `npm run build:enterprise` grønt på RC-commit |
| Produkt | Ingen åpen P0/P1 mot kjerneflyt uten akseptert unntak |
