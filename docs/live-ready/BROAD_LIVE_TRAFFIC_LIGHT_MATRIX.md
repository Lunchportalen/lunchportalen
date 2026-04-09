# Bred live — trafikklys-matrix

**Dato:** 2026-03-29

| # | Kategori | Status | Evidence | Why | Required action |
|---|----------|--------|------------|-----|-----------------|
| 1 | Access & security | **YELLOW** | API-guards + tester (`tests/security/**`); middleware ikke full rolle | Stor overflate; auth primært server/layout | Fortsett fail-closed per rute; begrens superadmin |
| 2 | Role enforcement | **YELLOW** | `scopeOr401`, `tests/auth/**`, `tests/tenant-isolation*.test.ts` | Ikke full middleware-rolle | Eksplisitt layout-guard + API-sannhet |
| 3 | Employee Week safety | **GREEN** | `lib/week/*`, `tests/lib/weekAvailability.test.ts`, uke-ruter | Kjerne testet | Overvåk B1 to-spor på sikt |
| 4 | Onboarding / pending / activation safety | **GREEN** | Frosset flyt; valideringstester | Ikke endret i denne pass | Ingen endring uten egen RC-sak |
| 5 | Billing / invoicing safety | **YELLOW** | `tests/billing/**`, integrasjonstester | Hybrid Stripe/Tripletex; økonomi-QA | Manuell QA før bred skala |
| 6 | Content / publish safety | **YELLOW** | `tests/cms/**`, outbox, merge-tester | Kompleks CMS | Redaksjonsprosess; superadmin scope |
| 7 | CMS / backoffice stability | **YELLOW** | `build:enterprise`, CMS-tester | Stor klientflate | Overvåkinger ved store endringer |
| 8 | Company admin runtime | **GREEN** | Admin API-tester, tenant-isolasjon | Scope-mønster etablert | Vedlikehold av scope i nye ruter |
| 9 | Kitchen runtime | **GREEN** | `tests/kitchen/**` | Read-only sannhet | Ingen manuelle overstyringer |
| 10 | Driver runtime | **GREEN** | `tests/driver/**` | Scope-tester | Mobil — følg S4 |
| 11 | Superadmin runtime | **YELLOW** | System/status-tester | Høy makt | Minimer brukere; audit-bevisst |
| 12 | Social calendar | **GREEN** | DB-drevet kalender | Intern sannhet | OK for bred live internt |
| 13 | Social publish | **RED→YELLOW*** | `PUBLISH_DRY_RUN` mønstre; UI-tekst oppdatert | Ekstern effekt nøkkelavhengig | *Med forhold: ikke lov å love reach uten nøkler |
| 14 | SEO runtime | **YELLOW** | SEO-skript i build; policy-tester | Review-first | Ingen stille auto-publish |
| 15 | ESG runtime | **YELLOW** | API + `tests/esg/**` | Tom data/estimater | Tydelig copy; ingen greenwashing |
| 16 | Cron / worker / outbox | **YELLOW** | `vercel.json` sync; `tests/api/cronOutbox*.test.ts`; worker delvis stub | Stub-jobs | Dokumenter hva som er LIVE vs STUB |
| 17 | Observability / alerting | **YELLOW** | Hendelseslogging, health APIs | Ikke full plattform | K3 senere; minimum i runbook |
| 18 | Backup / restore | **YELLOW** | Runbook tekst | Avhenger av Supabase/leverandør | Eier må verifisere i prod |
| 19 | Performance / scale confidence | **RED→YELLOW*** | Ingen bred lasttest dokumentert | Antakelser | *Skaler kontrollert; overvåk |
| 20 | Support / incident readiness | **YELLOW** | `LIVE_READY_RUNBOOK.md`, `LIVE_READY_SUPPORT_MODEL.md` | Menneskeavhengig | Navngi kontakter før GO |

**Note:** «RED→YELLOW*» betyr at ren teknisk risiko er **høy rød** uten tiltak; med **eksplisitte vilkår** i beslutningen klassifiseres området som **YELLOW** for kontrollert bred live.
