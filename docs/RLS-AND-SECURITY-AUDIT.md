# Lunchportalen — RLS og sikkerhetsrevisjon

**Status:** DOKUMENTFRYS · LOKAL FULLFØRT · EKSTERN DELVIS (2026-07-11)  
**Dato:** 2026-07-11  
**RLS-grunnlag:** Lokalt bekreftet for 61 aktive migrasjoner; golden snapshot (2026-07-02) forfalt; **hosted prod delvis verifisert** (MCP 2026-07-11)  
**Sortering:** Kritiske funn først  
**Dekning:** 7162 I · 85 P · M=0 — [OPEN-QUESTIONS.md §2](./OPEN-QUESTIONS.md#2-kanonisk-filregnskap-v6--m0)

---

## Innholdsfortegnelse

1. [Executive security summary](#1-executive-security-summary)
2. [Kritiske og høye funn](#2-kritiske-og-høye-funn)
3. [RLS-matrise (oppsummering)](#3-rls-matrise-oppsummering)
4. [Databaseprivilegier](#4-databaseprivilegier)
5. [Rolle- og tenantmodell](#5-rolle--og-tenantmodell)
6. [RPC- og SECURITY DEFINER-audit](#6-rpc--og-security-definer-audit)
7. [Storage-audit](#7-storage-audit)
8. [Edge Functions](#8-edge-functions)
9. [Next.js-sikkerhet](#9-nextjs-sikkerhet)
10. [Secrets](#10-secrets)
11. [CI/CD-sikkerhet](#11-cicd-sikkerhet)
12. [Uverifiserte områder](#12-uverifiserte-områder)

---

## 1. Executive security summary

### Total risikovurdering: **MODERAT** (lokalt bekreftet; hosted prod delvis verifisert 2026-07-11)

| Alvorlighet | Antall | Status |
|-------------|--------|--------|
| 🔴 Kritisk | 0 bekreftet | Ingen bekreftet datalekkasje i analyserte migrasjoner |
| 🟠 Høy | 6 | SEC-001, SEC-002, SEC-003, SEC-004, CRON-001, SR-001 |
| 🟡 Middels | 12 | RLS-001–004, NEXT-002–003, CI-001–002, SANITY-001, UMB-DESIGN-001 |
| ⚪ Lav | 12+ | Se TECH-DEBT.md |

### Viktigste angrepsflater

1. **Middleware API allowlist** — 565 ruter, 86 allowlisted; feil konfigurasjon blokkerer webhooks
2. **SECURITY DEFINER RPCs** — `lp_order_set`, `lp_billing_*`, lifecycle RPCs
3. **Service role** — `lib/supabase/admin.ts` (single entry, ~150+ konsumenter)
4. **Audit log partitions** — tidligere lekkasjerisiko, hardenet 2026-06-16
5. **Stripe provider billing webhooks** — potensielt blokkert av middleware

### Bekreftet vs uverifisert

| Bekreftet (kode + tester) | Uverifisert (krever remote) |
|---------------------------|----------------------------|
| RLS på 100 golden-tabeller | Live prod schema etter 2026-07-02 migrasjoner |
| Tenant isolation tester PASS | Auth hook funksjon deployet hosted; Dashboard-enable uavklart |
| Service role kun server-side | Azure App Service app settings |
| Internal RPC lockdown | Stripe webhook URL-konfigurasjon i Stripe Dashboard |
| Audit partition FORCE RLS | Branch protection effectiveness |

---

## 2. Kritiske og høye funn

### SEC-001 — Stripe provider webhooks blokkert av middleware (BEKREFTET 401)

| Felt | Verdi |
|------|-------|
| **Alvorlighet** | 🟠 Høy |
| **Status** | **Bekreftet** (kode + runtime allowlist-sjekk) |
| **System** | Next.js middleware → API route |
| **Tittel** | Provider Stripe webhooks når aldri route handler uten session |
| **Påvirkning** | `payment_intent.*` / `setup_intent.*` events til provider billing kan ikke prosesseres |
| **Angrepsscenario** | N/A — tilgjengelighetsbrudd, ikke eksploitering |
| **Bevis (ende-til-ende)** | |
| 1. Vercel routing | Ingen rewrite for webhooks (`vercel.json` — kun crons) |
| 2. `middleware.ts:115-136` | `/api/*` fail-closed: ikke allowlisted → krever session |
| 3. `middleware.ts:183-187` | Matcher inkluderer `/api/webhooks/stripe-*` |
| 4. `apiAllowlist.ts:9-91` | Mangler begge paths (runtime: `isApiAuthAllowlisted(...) === false`) |
| 5. `middleware.ts:69-80` | Ingen session → `401 JSON` med `x-lp-mw-api-auth: 401` (ikke redirect) |
| 6. Route handlers | `stripe-billing-payments/route.ts:10-26`, `stripe-provider-setup/route.ts:10-26` — signaturvalidering i lib, nås aldri uten allowlist |
| 7. Lib signatur | `lib/billing/stripePaymentWebhook.ts:111-124` (`constructEvent`); `lib/billing/stripeProviderSetup.ts:277-290` |
| 8. Env | `STRIPE_*` webhook secrets i lib (ikke eksponert); irrelevant når middleware blokkerer |
| 9. Tester | `api-allowlist-regression.test.ts:136-141` scanner `handleStripeWebhook` i route-filer, **ikke** `handleProviderStripe*` — gap bekreftet (TEST-001) |
| 10. Kontrast | `/api/saas/billing/webhook` allowlisted (`apiAllowlist.ts:86`) → middleware bypass OK |
| **Berørte filer** | `middleware.ts`, `apiAllowlist.ts`, `app/api/webhooks/stripe-*`, `lib/billing/stripe*.ts` |
| **Anbefalt retning** | Legg til i `API_AUTH_ALLOWLIST`; utvid regression-test |
| **Verifikasjon** | POST uten cookie mot staging → forvent `401` + `UNAUTHORIZED`, ikke `400` signaturfeil |
| **Uavklart** | Om Stripe Dashboard faktisk peker på disse URL-ene i prod (OQ-002) |

**Merk:** `/api/saas/billing/webhook` **er** allowlisted (`apiAllowlist.ts:86`) og dekker SaaS-billing. SEC-001 gjelder den **nye** provider billing engine.

#### SEC-001 — fullført route-analyse (gruppe 3)

| Aspekt | Middleware-blokkering | Sikkerhet inne i route | Regression-test |
|--------|----------------------|------------------------|-----------------|
| Status | **401** uten session (`x-lp-mw-api-auth: 401`) | Signatur valideres **før** parse/skriv (`constructEvent` på rå body) | **Mangler** for provider-ruter (TEST-001) |
| Service role | N/A (nårs ikke) | `supabaseAdmin()` i `stripePaymentWebhook.ts`, `stripeProviderSetup.ts` | — |
| Idempotens | N/A | `stripe_billing_webhook_events.stripe_event_id` UNIQUE; returnerer `duplicate: true` | Unit i lib; ikke middleware→route |
| Replay | N/A | Stripe event-ID lagres; ingen tidsvindu-replay-guard utover Stripe | — |
| Allowlist-fiks | Vil tillate anon når signatur OK | Route er trygg **hvis** secret er satt | Må utvide `api-allowlist-regression.test.ts` |

**Stripe eventtyper (provider):**

| Rute | Eventtyper | Tabeller/RPC skrevet |
|------|------------|----------------------|
| `stripe-billing-payments` | `payment_intent.*`, `charge.*` | `stripe_billing_webhook_events`, `billing_payment_attempts`, `provider_commission_invoices`, `lp_billing_apply_payment_recovery_policy` |
| `stripe-provider-setup` | `checkout.session.completed`, `setup_intent.succeeded`, `payment_method.attached`, `customer.updated` | `stripe_billing_webhook_events`, `organization_billing_profiles`, `payment_methods`, `billing_audit_log` |

---

### SEC-002 — Golden RLS snapshot forfalt (10+ migrasjoner)

| Felt | Verdi |
|------|-------|
| **Alvorlighet** | 🟠 Høy |
| **Status** | Bekreftet |
| **System** | Supabase RLS drift detection |
| **Tittel** | `golden-rls-snapshot.json` fanget 2026-07-02; 10 migrasjoner etterpå ikke i snapshot |
| **Påvirkning** | `rls-drift-check.yml` kan gi falsk negativ eller miss nye tabeller/policies |
| **Bevis** | `tests/rls/golden-rls-snapshot.json:3-4` (`generated_at: 2026-07-02`). Siste migrasjon: `20260810120000_msdi_localized_sot_snapshot_trigger_alignment.sql`. Nye tabeller: billing engine (`20260729120000`, 27 policies), `menu_content_translations` (5 policies), `provider_price_rules`, etc. |
| **Anbefalt retning** | Regenerer snapshot: `node scripts/rls/snapshot-rls.mjs` mot staging/prod; verifiser med `node scripts/check-rls-drift.mjs` |
| **Verifikasjon** | Kjør drift-check mot prod read-only |

---

### SEC-003 — GitHub main: 0 required PR reviews (ruleset + deployment-gate)

| Felt | Verdi |
|------|-------|
| **Alvorlighet** | 🟠 Høy |
| **Status** | Bekreftet (remote 2026-07-11) |
| **System** | GitHub |
| **Tittel** | `main` ruleset uten påkrevde PR-reviews; delvis kompensert av CI + Production environment |
| **Påvirkning** | Merge til `main` uten review; admin kan bypass-e environment-gates |
| **Bevis** | Ruleset `main-protection` (id 17188414): `required_approving_review_count=0`, required check `suspend-rpc-authz`, deletion+non-fast-forward blokkert, force push av, bypass actors: ingen. Branch protection: `enforce_admins=true`. Environment `Production`: required reviewer `Lunchportalen` (deployment approval, **ikke** PR-gate). Preview/staging: ingen required reviewers. |
| **Kompenserende kontroller** | `suspend-rpc-authz` required status check; linear history; Production deployment reviewer |
| **Gjenstående gap** | 0 PR-reviews på merge til main; CODEOWNERS placeholder; Dependabot deaktivert |
| **Anbefalt retning** | `required_approving_review_count: 1` minimum på ruleset; reelle CODEOWNERS |
| **Verifikasjon** | `gh api repos/.../rulesets/17188414` + environments API |

---

### SEC-004 — `setCompanyStatus` server action uten superadmin-gate (REKLASSIFISERT 🟠 Høy)

| Felt | Verdi |
|------|-------|
| **Alvorlighet** | 🟠 **Høy** (opp fra 🟡 Middels etter E2E-spor) |
| **Status** | **Bekreftet** (kode + RLS + policy-analyse) |
| **System** | Next.js Server Action → Supabase JWT |
| **Tittel** | `company_admin` kan mutere `companies.status` på eget firma via action uten superadmin-sjekk |
| **Påvirkning** | Firmalivssyklus (ACTIVE/PAUSED/CLOSED) skal være superadmin-only; action omgår forretningsregel |
| **Angrepsscenario** | Autentisert `company_admin` med `can_manage_company` kaller `setCompanyStatus(ownCompanyId, "ACTIVE")` mens firma står `PENDING` — omgår superadmin-godkjenning |
| **Klassifisering** | **Produktregelbrudd** + **arkitekturinkonsistens** (action vs kanonisk API) — ikke avkreftet |

**Statusverdier og validering:**

| Felt | Verdi |
|------|-------|
| Lovlige verdier i action | `ACTIVE`, `PAUSED`, `CLOSED`, `PENDING` (`normalizeStatus` — `actions.ts:13-17`) |
| Database enum | `LEAD`, `PENDING`, `ACTIVE`, `PAUSED`, `CLOSED`, `TERMINATED` (`baseline:143-149`) |
| Inputvalidering | String-normalisering i action; **ingen** Zod; DB enum avviser ugyldige |
| Kanonisk API | `normalizeCompanyLifecycleStatus` + superadmin-triple-gate (`set-status/route.ts`) |

**Hva kan `company_admin` gjøre via action (eget firma)?**

| Handling | Mulig via action | Superadmin-only intensjon |
|----------|------------------|---------------------------|
| `PENDING` → `ACTIVE` (selvaktivering) | **Ja** (RLS `companies_update`) | **Nei** — brudd |
| `ACTIVE` → `PAUSED` | **Ja** | **Nei** — brudd |
| `ACTIVE` → `CLOSED` | **Ja** | **Nei** — brudd |
| Oppheve superadmin-pause | **Ja** (`PAUSED`→`ACTIVE`) | **Nei** — brudd |
| Endre faktureringsstatus | **Nei** (annen tabell) | — |
| Endre onboardingstatus direkte | Delvis via `PENDING`→`ACTIVE` | **Nei** |

**Sideeffekter når status endres:**

| System | Påvirket | Mekanisme |
|--------|----------|-----------|
| Bestilling | **Ja** | `lib/auth/scope.ts:168-187` — `enforceCompanyActive`: tenant-roller blokkert når `status !== active` |
| API-tilgang (employee) | **Ja** | Scope-gate → 403 `COMPANY_NOT_ACTIVE` |
| Fakturering | **Indirekte** | Cron `invoices/generate` leser `orders`/`agreements`; paused/closed firma stopper bestillinger |
| Leverandørtilknytning | **Nei** direkte | `provider_id` på `companies` endres ikke |
| Innlogging | **Nei** direkte | Auth OK; scope/API blokkerer operasjoner |
| Produksjon/kitchen | **Indirekte** | Ingen nye ordre når ikke ACTIVE |
| Audit | **Nei** i action | Kanonisk API logger `COMPANY_STATUS_CHANGED` |

**Action vs kanonisk API:**

| Regel | Server action | `POST /api/superadmin/companies/set-status` |
|-------|---------------|-------------------------------------------|
| Superadmin-gate | Mangler | `requireRoleOr403` + `isSuperadminProfile` |
| Idempotens | Nei | `applyCompanyLifecycleStatus` (`already`) |
| Audit | Nei | `logOpsEventBestEffort` |
| RLS alene | Tillater `company_admin` | Superadmin JWT + RLS `companies_write_superadmin` |

**Konklusjon:** Bekreftet sikkerhetsproblem / produktregelbrudd — **ikke** legitim selvbetjening. Alvorlighet **🟠 Høy** pga. mulig `PENDING`→`ACTIVE` uten superadmin.

**Ende-til-ende-spor:**

| # | Lag | Bevis |
|---|-----|-------|
| 1 | UI (superadmin) | `components/superadmin/CompanyStatusControls.tsx:76` → `setCompanyStatus` action |
| 2 | UI (kanonisk) | `companies-client.tsx:150` → `POST /api/superadmin/companies/set-status` (korrekt gate) |
| 3 | Action | `app/superadmin/firms/[companyId]/actions.ts:26-44` — **ingen** `requireSuperadmin` / `getAuthContext` |
| 4 | Klient | `supabaseServer()` — brukerens JWT, **ikke** service role |
| 5 | DB write | `companies.update({ status })` `.eq("id", company_id)` |
| 6 | RLS UPDATE | `companies_update`: `private.can_manage_company(id)` — inkluderer `company_admin` (`role_is_company_manager`: `company_admin`, `admin`, `owner`) |
| 7 | RLS superadmin | `companies_write_superadmin`: `is_superadmin()` — OR med #6 |
| 8 | Cross-tenant | **Blokkert** — `can_manage_company` krever membership på `company_id` |
| 9 | Audit | Action: **ingen**. Kanonisk API: `logOpsEventBestEffort` (`set-status/route.ts:67-77`) |
| 10 | Tester | **Ingen** for action. API: `admin.company-status-set-forbidden.test.ts` (403 deprecated route). RLS: `companyAdminStatusGate.test.ts` tester order toggle, **ikke** status-mutasjon |

**Svar på revisjonsspørsmål:**

| Spørsmål | Svar |
|----------|------|
| Kan vanlig autentisert bruker kalle actionen? | **Ja** — enhver innlogget bruker med gyldig session kan invoke Server Action |
| Kalles kun fra superadmin-UI? | **Nei** — Server Actions er ikke bundet til UI-plassering |
| Brukes service role? | **Nei** |
| Kan `companyId` peke på vilkårlig org? | **Ja** som input, men RLS begrenser til egne managed companies |
| Stopper RLS ikke-superadmin? | **Nei** for `company_admin` på eget firma — `companies_update` tillater UPDATE |
| Server-side rollekontroll? | **Mangler** i action |
| Database-side rollekontroll? | **Delvis** — RLS tillater company managers, ikke kun superadmin |
| Audit logging? | **Mangler** i action |

**Anbefalt retning (arkitektonisk):** Deprecate action; bruk kun `POST /api/superadmin/companies/set-status`; eller legg til samme gate som `set-status/route.ts:37-46`.

#### SEC-004 — Overgangsmatrise (alle `company_status`-verdier)

**Database enum** (`baseline:143-149`): `LEAD`, `PENDING`, `ACTIVE`, `PAUSED`, `CLOSED`, `TERMINATED`  
**Action/API normaliserer til:** `PENDING`, `ACTIVE`, `PAUSED`, `CLOSED` — `LEAD`/`TERMINATED` mappes til `PENDING` i action (`normalizeStatus` fallback).

| Fra | Til | Company admin via action | Superadmin API | RLS `companies_update` | Produktregel | Risiko |
| --- | --- | -----------------------: | -------------: | ---------------------: | ------------ | ------ |
| LEAD | ACTIVE | Ja (→PENDING først ugyldig enum; DB constraint) | Ja | Ja hvis manager | Superadmin-only | 🟠 |
| LEAD | PENDING | Ja | Ja | Ja | OK | 🟡 |
| PENDING | ACTIVE | **Ja** | Ja | **Ja** | **Superadmin-only** | **🟠 Høy** |
| PENDING | PAUSED | Ja | Ja | Ja | Uvanlig | 🟡 |
| PENDING | CLOSED | Ja | Ja | Ja | Superadmin-only | 🟠 |
| ACTIVE | PAUSED | **Ja** | Ja | **Ja** | Superadmin-only | **🟠** |
| ACTIVE | CLOSED | **Ja** | Ja | **Ja** | Superadmin-only | **🟠** |
| PAUSED | ACTIVE | **Ja** (gjenåpning) | Ja | **Ja** | Superadmin-only | **🟠** |
| PAUSED | CLOSED | Ja | Ja | Ja | Superadmin-only | 🟠 |
| CLOSED | ACTIVE | **Ja** (gjenåpning) | Ja | **Ja** | Superadmin-only | **🟠** |
| TERMINATED | * | Action→PENDING; DB kan avvise | API avviser ugyldig | Avhenger av constraint | Hard stopp | 🟡 |
| * | LEAD/TERMINATED | Action kan ikke sette (fallback PENDING) | API avviser | DB enum | N/A | ⚪ |

**Sideeffekter ved statusendring:**

| Område | Påvirket | Mekanisme | Audit i action |
|--------|----------|-----------|----------------|
| Bestilling | Ja | `enforceCompanyActive` → 403 når ikke ACTIVE | Nei |
| Employee API | Ja | `scopeOr401` + company status | Nei |
| Fakturering | Indirekte | Ingen nye ordre → ingen nye linjer | Nei |
| Onboarding | Ja | `PENDING`→`ACTIVE` uten superadmin-godkjenning | Nei |
| Suspensjon | Ja | `company_admin` kan oppheve PAUSED | Nei |
| Arkivering | Delvis | `CLOSED` via action uten audit | Nei |
| E-post/varsler | Nei | Ingen trigger i action | Nei |
| Provisjon | Indirekte | Via ordrestopp | Nei |

**Konklusjon alvorlighet:** Forblir **🟠 Høy** — bekreftet `PENDING`→`ACTIVE` selvaktivering uten superadmin, uten audit, uten sideeffekt-kjede fra `applyCompanyLifecycleStatus`.

---

### CRON-001 — `x-vercel-cron: 1` uten secret-validering

| Felt | Verdi |
|------|-------|
| **Alvorlighet** | 🟠 Høy |
| **Status** | Bekreftet |
| **System** | Cron auth (`lib/http/cronAuth.ts`) + middleware allowlist |
| **Tittel** | Cron-ruter kan trigges med spoofbar header når `CRON_SECRET` mangler |
| **Påvirkning** | 29 cron-ruter allowlisted uten session; 16 bruker `supabaseAdmin()`; `invoices/generate` skriver `invoice_periods` + outbox |
| **Angrepsscenario** | `POST /api/cron/invoices/generate` med `x-vercel-cron: 1` uten secret i miljø uten `CRON_SECRET` |
| **Bevis** | `cronAuth.ts:29-31`; `cronAuth.test.ts:39-42`; `apiAllowlist.ts:26-54`; `invoices/generate/route.ts:285,310` |
| **Mitigering (Vercel)** | Kommentar i kode: header injisert av Vercel — **ikke verifisert** i denne revisjonen |
| **Fail-closed?** | **Nei** når secret mangler og header sendes |
| **Idempotens** | Delvis på `invoices/generate` (`company_id,period` upsert); ikke global replay-guard |
| **Rate limiting** | **0** cron-ruter med rate limit |

**CRON-001 — 11 kontrollspørsmål (kodebevis):**

| # | Spørsmål | Svar |
|---|----------|------|
| 1 | Kan ekstern HTTP-klient sende `x-vercel-cron: 1`? | **Ja** — vanlig HTTP-header; ingen TLS-binding |
| 2 | Signerer Vercel headeren? | **Ikke verifisert** i app-kode; kommentar i `cronAuth.ts:16-17` |
| 3 | Validerer app Vercel-opprinnelse? | **Nei** |
| 4 | Route protection vs allowlist | Middleware allowlist **først** (`middleware.ts:116`) → cron nås uten session |
| 5 | Cron-ruter via fallback | **29** (alle `/api/cron/*` allowlisted) |
| 6 | Med service role | **16** av 29 |
| 7 | Skriver tabeller/RPC | **10** ruter med `.insert/.update/.upsert`; tabeller inkl. `invoice_periods`, `orders`, `outbox`, `agreements` (per-rute variasjon) |
| 8 | Jobber som genererer faktura | **8** økonomi-kategoriserte (`invoices/generate`, `tripletex-*`, `revenue`, …) |
| 9 | Idempotente | Delvis dokumentert på `invoices/generate`; **29** ikke uniformt verifisert |
| 10 | Replay mulig | **Ja** — ingen replay-guard utover idempotente upserts |
| 11 | Konsekvens | Økonomisk (`invoice_periods`), driftsmessig (outbox, meny-sync), personvern (invites cleanup) ved misconfig |

**Alvorlighet:** **🟠 Høy** når `CRON_SECRET` mangler i prod; **🔴 Kritisk** hvis økonomiske service-role-jobber (`invoices/generate`, `tripletex-*`) er utløsbare uten secret i prod (remote uverifisert).

#### CRON-001 — Alle 29 cron-ruter

| Rute | Funksjon | Headerfallback | Secret | Service role | Data skrevet | Økonomisk effekt | Idempotens | Gjentakbar | Alvorlighet |
| ---- | -------- | -------------: | -----: | -----------: | ------------ | ---------------: | ---------: | ---------: | ----------- |
| `/api/cron/ai-experiment-generator` | okonomi+ai | ja | SYSTEM_MOTOR_SECRET | nei | nei | ja | ukjent | ja | ⚪ Lav |
| `/api/cron/autopilot` | system | ja | SYSTEM_MOTOR_SECRET | nei | nei | nei | ukjent | ja | ⚪ Lav |
| `/api/cron/business` | system | ja | SYSTEM_MOTOR_SECRET | ja | nei | nei | ukjent | ja | 🟡 Middels |
| `/api/cron/check-deviations` | ordre+leveranse+meny+epost | ja | CRON_SECRET | ja | outbox,orders,kitchen_batches | nei | delvis | ja | 🟡 Middels |
| `/api/cron/cleanup-invites` | bruker | ja | CRON_SECRET | ja | employee_invites | nei | ukjent | ja | 🟡 Middels |
| `/api/cron/daily-order-summary` | ordre+epost | ja | CRON_SECRET | ja | outbox,orders,companies | nei | delvis | ja | 🟡 Middels |
| `/api/cron/daily-sanity` | ordre+meny | ja | CRON_SECRET | ja | nei | nei | ukjent | ja | 🟡 Middels |
| `/api/cron/experiments` | system | ja | SYSTEM_MOTOR_SECRET | ja | nei | nei | ukjent | ja | 🟡 Middels |
| `/api/cron/forecast` | system | ja | CRON_SECRET | nei | nei | nei | ukjent | ja | ⚪ Lav |
| `/api/cron/global-learning` | system | ja | SYSTEM_MOTOR_SECRET | ja | nei | nei | ukjent | ja | 🟡 Middels |
| `/api/cron/invoices/generate` | okonomi+ordre | ja | CRON_SECRET | ja | invoice_periods,orders,agreements | **ja** | delvis | ja | **🟠 Høy** |
| `/api/cron/kitchen-print` | ordre+leveranse | ja | CRON_SECRET | ja | ja | nei | ukjent | ja | 🟡 Middels |
| `/api/cron/meal-learning` | ordre+meny | ja | CRON_SECRET | nei | nei | nei | ukjent | ja | ⚪ Lav |
| `/api/cron/menu-service-day-reconcile` | meny | ja | CRON_SECRET | ja | MSD/MSDI | nei | ukjent | ja | 🟡 Middels |
| `/api/cron/menu-week-opening-notify` | meny+epost | ja | CRON_SECRET | nei | nei | nei | ukjent | ja | ⚪ Lav |
| `/api/cron/menu-week-rollout` | meny | ja | CRON_SECRET | ja | nei | nei | ukjent | ja | 🟡 Middels |
| `/api/cron/monitoring` | system | ja | CRON_SECRET | nei | nei | nei | ukjent | ja | ⚪ Lav |
| `/api/cron/outbox` | epost | ja | CRON_SECRET | ja | cron_runs | nei | ukjent | ja | 🟡 Middels |
| `/api/cron/pipeline` | okonomi+ordre | ja | CRON_SECRET | nei | nei | ja | ukjent | ja | ⚪ Lav |
| `/api/cron/preprod` | leveranse | ja | CRON_SECRET | nei | nei | nei | ukjent | ja | ⚪ Lav |
| `/api/cron/revenue` | okonomi | ja | SYSTEM_MOTOR_SECRET | nei | nei | ja | ukjent | ja | ⚪ Lav |
| `/api/cron/social` | system | ja | CRON_SECRET | nei | nei | nei | ukjent | ja | ⚪ Lav |
| `/api/cron/system-motor` | system | ja | SYSTEM_MOTOR_SECRET | nei | nei | nei | ukjent | ja | ⚪ Lav |
| `/api/cron/tripletex-agreements-daily` | okonomi | ja | CRON_SECRET | ja | lifecycle_audit_log | **ja** | ukjent | ja | **🟠 Høy** |
| `/api/cron/tripletex-connection-health-daily` | okonomi | ja | CRON_SECRET | ja | provider_tripletex_credentials | **ja** | ukjent | ja | **🟠 Høy** |
| `/api/cron/tripletex-outbox` | okonomi+epost | ja | CRON_SECRET | nei | nei | ja | ukjent | ja | ⚪ Lav |
| `/api/cron/tripletex-saas-monthly` | okonomi | ja | CRON_SECRET | ja | lifecycle_audit_log | **ja** | delvis | ja | **🟠 Høy** |
| `/api/cron/week-scheduler` | meny+epost | ja | CRON_SECRET | nei | nei | nei | ukjent | ja | ⚪ Lav |
| `/api/cron/week-visibility` | meny | ja | CRON_SECRET | ja | menu_visibility_days | nei | delvis | ja | 🟡 Middels |

**Oppsummering:** 29 ruter totalt; **16** med service role; **8** økonomi-relaterte; **10** med direkte DB-skriv; **0** rate limiting; **0** Vercel-signaturvalidering; **0** source-IP-validering.

**Header-forfalskning:** Ekstern klient **kan** sende `x-vercel-cron: 1` — ingen kryptografisk binding i app-kode (`cronAuth.ts:29-31`). Kommentar om Vercel-injeksjon er **ikke** fail-closed verifisering.

---

### SR-001 — Service role-bruk (573 importsteder) — REKLASSIFISERT 🟠 Høy

| Felt | Verdi |
|------|-------|
| **Alvorlighet** | 🟠 **Høy** (opp fra 🟡 — eksponeringsanalyse) |
| **Status** | Bekreftet |
| **System** | `lib/supabase/admin.ts` |
| **Tittel** | Bred service role; 47 API-ruter stoler kun på middleware-session uten handler-auth |
| **Påvirkning** | Kompromittert session + route uten rollekrav → potensielt `supabaseAdmin()`-kall |
| **Bevis** | Import-scan: 573 filer; 510 prod; 265 API; 47 middleware-only API-ruter |

**Importklassifisering (eksakt):**

| Inngangstype | Antall filer |
|--------------|-------------:|
| API route | 265 |
| Server-only library | 223 |
| Cron route | 16 |
| Webhook | 3 |
| Server action | 3 |
| Test | 54 |
| Script | 7 |
| Re-export | 2 |
| **Sum** | **573** |

**Produksjonsrelevante (510) — sikkerhetstall:**

| Metrikk | Antall |
|---------|-------:|
| Med eksplisitt rollevalidering | 222 |
| Med eksplisitt tenant-mønster | 146 |
| API-ruter kun middleware-auth | 47 |
| Offentlige ruter med service role | 12 |
| Offentlige ruter med skriv | 10 |
| Skriv-operasjoner (`insert/update/upsert/rpc`) | 224 filer |

**Positivt:** Nøkkel kun i `admin.ts`; `server-only`; fail-closed uten env.

**Anbefalt retning:** Audit 47 middleware-only ruter; krev handler-gate før `supabaseAdmin()`; vurder wrapper med route-context assert.

#### SR-001 — Ti offentlige skriveruter (`/api/public/*` + service role + skriv)

| Rute | Offentlig grunn | Ekstern verifikasjon | Service role | Data skrevet | Signatur/secret | Idempotens | Risiko |
| ---- | --------------- | -------------------- | -----------: | ------------ | --------------- | ---------: | ------ |
| `/api/public/ai-demo-cta/assign` | allowlist lead/demo | nei | ja | ja | nei | ukjent | 🟡 |
| `/api/public/analytics` | allowlist analytics | nei | ja | ja | nei | delvis | 🟡 |
| `/api/public/coverage/check` | allowlist coverage | nei | ja | ja | nei | ukjent | 🟡 |
| `/api/public/forms/[id]` | allowlist forms | nei | ja | ja | nei | ukjent | 🟡 |
| `/api/public/leads/capture` | allowlist lead capture | nei | ja | ja | nei | delvis | 🟠 |
| `/api/public/onboarding/register` | allowlist onboarding | nei | ja | ja | nei | delvis | 🟠 |
| `/api/public/register-company` | allowlist registration | nei | ja | ja | nei | delvis | 🟠 |
| `/api/public/search` | allowlist search index | nei | ja | nei | nei | — | ⚪ |
| `/api/public/track-event` | allowlist CRO | nei | ja | ja | nei | ukjent | 🟡 |

*Ni ruter med skriv; `/api/public/search` er lesende. Tidligere «10» inkluderte `route_backup.txt` (ikke aktiv rute).*

#### SR-001 — 46 API-ruter med kun middleware-auth (ingen scopeOr401/rolle/signatur i handler)

| Rute | Middleware-kontroll | Handler-auth | Rolle | Tenant | Brukerstyrt ID | Data skrevet | Risiko |
| ---- | ------------------- | ------------ | ----- | ------ | -------------: | ------------ | ------ |
| `/api/accept-invite/complete` | session bypass (allowlist) | ingen | — | delvis | ja | skriv | 🟡 legitim invite |
| `/api/admin/accept-invite/complete` | allowlist | ingen | — | delvis | ja | skriv | 🟡 |
| `/api/admin/invites/lookup` | allowlist | ingen | — | nei | ja | les | 🟡 |
| `/api/admin/invites/register` | allowlist | ingen | — | delvis | ja | skriv | 🟡 |
| `/api/agreements/my-latest` | session | ingen | — | ja | nei | les | ⚪ |
| `/api/auth/accept-invite` | allowlist | ingen | — | nei | ja | skriv | 🟡 auth-flyt |
| `/api/auth/forgot-password` | allowlist | ingen | — | nei | ja | les/skriv | 🟡 auth-flyt |
| `/api/auth/register-company-admin` | allowlist | ingen | — | nei | ja | skriv | 🟡 |
| `/api/backoffice/experiments/event` | session | ingen | — | uklart | ja | skriv | 🟡 |
| `/api/experiments/assign` | allowlist | ingen | — | nei | ja | les | ⚪ |
| `/api/experiments/track` | allowlist | ingen | — | nei | ja | les | ⚪ |
| `/api/health` | allowlist | ingen | — | nei | nei | les | ⚪ |
| `/api/kitchen/day` | session | ingen | — | provider | nei | les | 🟡 |
| `/api/me/agreement` | session | ingen | — | ja | nei | les | ⚪ |
| `/api/onboarding/complete` | allowlist | ingen | — | nei | ja | skriv | 🟡 onboarding |
| `/api/order/bulk-set` | session | ingen | — | ja | ja | skriv | 🟠 ordre |
| `/api/order/cancel` | session | ingen | — | ja | ja | skriv | 🟠 ordre |
| `/api/orders/[orderId]/cancel` | session | ingen | — | ja | ja | les | 🟡 |
| `/api/orders/[orderId]/toggle` | session | ingen | — | ja | ja | les | 🟡 |
| `/api/profile` | session | ingen | — | ja | nei | les | ⚪ |
| `/api/profile/set-scope` | session | ingen | — | ja | nei | les | ⚪ |
| `/api/provider/menu-days` | session | ingen | — | provider | nei | les | 🟡 |
| `/api/provider/menu-days/varmrett` | session | ingen | — | provider | nei | les | 🟡 |
| `/api/provider/menu-days/varmrett/reset` | session | ingen | — | provider | nei | skriv | 🟡 |
| `/api/provider/menu-days/varmrett/generate` | session | ingen | — | provider | nei | skriv | 🟡 |
| `/api/provider/menu-days/varmrett/suggestions` | session | ingen | — | provider | nei | les | 🟡 |
| `/api/provider/menu-catalog` | session | ingen | — | provider | nei | les | 🟡 |
| `/api/provider/menu-generator/week-preview` | session | ingen | — | provider | nei | les | 🟡 |
| `/api/provider/menu-generator/apply-week` | session | ingen | — | provider | nei | skriv | 🟡 |
| `/api/provider/menu-profile/mapping-draft` | session | ingen | — | provider | nei | skriv | 🟡 |
| `/api/provider/menu-profile/publish-shadow` | session | ingen | — | provider | nei | skriv | 🟡 |
| `/api/provider/menu-profile/week-shadow` | session | ingen | — | provider | nei | skriv | 🟡 |
| `/api/provider/menu-profile/compatibility-cutover` | session | ingen | — | provider | nei | skriv | 🟡 |
| `/api/provider/menu-translations` | session | ingen | — | provider | nei | skriv | 🟡 |
| `/api/provider/menu-translations/[id]` | session | ingen | — | provider | nei | skriv | 🟡 |
| `/api/provider/menu-translations/sources` | session | ingen | — | provider | nei | les | 🟡 |
| `/api/provider/billing/payment-method/setup` | session | ingen | — | provider | nei | skriv | 🟠 billing |
| `/api/provider/customers/[companyId]/agreement` | session | ingen | — | provider | ja | skriv | 🟠 |
| `/api/provider/customers/[companyId]/remove` | session | ingen | — | provider | ja | skriv | 🟠 |
| `/api/provider/customers/[companyId]/restore` | session | ingen | — | provider | ja | skriv | 🟠 |
| `/api/saas/billing` | session | ingen | — | tenant | nei | les | 🟡 |
| `/api/saas/billing/webhook` | allowlist | signatur | — | nei | skriv | ja | ⚪ legitim webhook |
| `/api/saas/onboarding` | session | ingen | — | tenant | nei | skriv | 🟡 |
| `/api/saas/tenant` | session | ingen | — | tenant | nei | les | 🟡 |
| `/api/social/track` | allowlist | ingen | — | nei | ja | les | ⚪ |
| `/api/system/outbox/process` | allowlist | SYSTEM_MOTOR_SECRET | — | nei | skriv | delvis | 🟡 intern |
| `/api/v1/public/orders` | allowlist | ingen | — | nei | ja | les | 🟡 |

*Tidligere «47» — 46 bekreftet i kode-scan; differanse kan skyldes én rute med delvis `scopeOr401` i dynamisk import.*

**Reklassifisering SR-001:** Alvorlighet forblir **🟠 Høy** pga. kombinasjon middleware-only + service role på ordre-, provider- og billing-ruter — ikke pga. importtall alene.

---

## 2b. Verifiserte G5-funn (endelig)

### BILL-001 — Provisjon TS vs SQL (REKLASSIFISERT ⚪ Lav)

| Felt | Verdi |
|------|-------|
| **Status** | Avkreftet som fakturafeil — **sannsynlig konsistent** |
| **Alvorlighet** | ⚪ Lav (vedlikehold, ikke sikkerhet) |
| **Autoritativ kilde** | SQL `private.lp_billing_post_delivered_commission_unchecked` + `commission_ledger` |
| **TS-rolle** | Preview/unit-test i `lib/billing/globalCommission.ts` |

| Implementasjon | Fil/objekt | Grunnlag | Sats | Avrunding | Resultat |
| -------------- | ---------- | -------- | ---: | --------- | -------- |
| TypeScript | `globalCommission.ts:67-84` | `commissionBasisAmountMinor` | 500 bps default | half-away-from-zero / 10000 | Unit-test |
| SQL seed | `20260729120000:335-336` | `NET_LUNCH_MENU_SALES_EX_TAX` | 500 bps | SQL numeric / 10000 | Ledger |
| SQL ledger | `20260730120000:325` | snapshot basis | snapshot rate | `/ 10000` | Persistert |

**Test:** `tests/lib/billing/globalCommission.test.ts` — validerer TS only; **ingen** SQL↔TS parity-test.

**Konsekvens:** Feil faktura **ikke dokumentert**; drift mulig ved fremtidig endring uten synk.

---

### ORD-001 — Produksjonsstatus UI vs server (REKLASSIFISERT ⚪ Lav)

| Entitet | Fra | Til | UI-sperre | Server-sperre | DB-sperre | Direkte kall | Konsekvens |
| ------- | --- | --- | --------: | ------------: | --------: | ------------ | ---------- |
| Order (kitchen) | ACTIVE/LOCKED | PREPARED | `nextKitchenTarget` (display) | `lp_order_advance_status` | **ja** `INVALID_STATUS_TRANSITION` | RPC med provider scope | UI-only label — **ikke sikkerhetsbrudd** |
| Order | PREPARED | DISPATCHED | ja | ja | **ja** | ja | OK |
| Order | DISPATCHED | DELIVERED | ja | ja | **ja** | ja | OK |
| Order | CANCELLED | * | skjult i UI | **ja** `ORDER_NOT_ADVANCEABLE` | **ja** | RPC avviser | OK |

**Bevis:** `supabase/migrations/20260730120000:412-454` — eksplisitt overgangsmatrise i DB.

---

### INV-001 — Invite replay (REKLASSIFISERT — kontroll finnes)

| Felt | Verdi |
|------|-------|
| **Status** | **Kontrollen finnes; regression-test mangler** |
| **Alvorlighet** | ⚪ Lav (testhull), ikke 🔴 sikkerhetskontroll |
| **Bevis** | `resolveEmployeeInviteContext.ts:41-42` (`used_at`); `accept-invite/complete/route.ts:128,278-280` (atomic `used_at` update med `.is("used_at", null)`) |
| **Manglende test** | E2E replay etter `used_at` / revoked invite |

---

### OBS-002 — Audit ved `setCompanyStatus` (BEKREFTET 🟡 Middels)

| Felt | Verdi |
|------|-------|
| **Status** | Bekreftet |
| **Alvorlighet** | 🟡 Middels (sporbarhet, ikke datalekkasje) |
| **Bevis** | `actions.ts:26-57` — ingen `logOpsEvent` / audit; kontrast `set-status/route.ts:67-77` |
| **DB-trigger** | Ingen `COMPANY_STATUS` trigger funnet i migrasjoner |
| **Konsekvens** | Statusendring uten spor i ops/audit — kombinert med SEC-004 produktregelbrudd |

---

## 2c. G6 sikkerhetsfunn (etter Fase 7 QC)

| ID | Status | Alvorlighet | Funn | Bevis |
|----|--------|-------------|------|-------|
| UI-001 | Falsk positiv | — | Client redirect i auth | `RegisterEmployeeClient.tsx:162` post-auth UX; server/API gate på invite |
| STATE-001 | Avkreftet | ⚪ | localStorage | `useSettings.ts:36` sessionStorage UI-cache; ingen sensitiv tenantdata |
| CACHE-001 | Avkreftet | — | Cross-tenant cache | `readGlobal.ts:119-131` global public; `loadAdminContextCached.ts:8` request-scoped |
| SCRIPT-001 | Sannsynlig (27) | 🟡 | SR i scripts | Smoke/e2e med env-guard; se matrise nedenfor |
| SCRIPT-002 | Bekreftet | 🟠 | Prod mutasjon | `scripts/k6/provision-k6-prod-pool.mjs` |
| OBS-002 | Bekreftet | 🟡 | Audit gap | `actions.ts:26-57` uten opsLog |

### SCRIPT-001 matrise (utdrag, manuelt verifisert)

| Script | Service role | Standardmiljø | Prod mulig | Muterer | Risiko |
|--------|:------------:|---------------|:----------:|:-------:|--------|
| `scripts/smoke/provision-smoke-user.mjs` | ja | `.env.local` | nei* | ja | 🟡 |
| `scripts/smoke/_first-menu-order-smoke.mjs` | ja | lokal/staging | nei* | ja | 🟡 |
| `scripts/k6/provision-k6-pool.mjs` | ja | `.env.local` | nei | ja | 🟡 |
| `scripts/k6/provision-k6-prod-pool.mjs` | ja | **prod** | **ja** | ja | 🟠 |
| `scripts/e2e/seed-e2e-provider-kitchen-access.mjs` | ja | test | nei | ja | 🟡 |
| `scripts/audit/dc-011-route-inventory.mjs` | nein* | read-only | nei | nei | ⚪ |
| `scripts/audit/e1-git-secrets-scan.mjs` | nein | read-only | nei | nei | ⚪ |

\*Krever eksplisitt env; ikke standard CI mot prod.

**Uverifiserte kandidater fra regex-batch:** 49 høye + 91 middels — **ikke** inkludert i endelig funnstatistikk.

---

### RLS-001 — Billing catalog open SELECT

| Felt | Verdi |
|------|-------|
| **Alvorlighet** | 🟡 Middels |
| **Status** | Bekreftet, tilsiktet |
| **System** | Supabase RLS |
| **Tittel** | `billing_products` / `billing_tax_codes` har `USING (true)` for authenticated SELECT |
| **Bevis** | `20260609120000_dc018_enable_rls_billing.sql:16-20`, golden snapshot policy `billing_products_select_authenticated` |
| **Konsekvens** | Alle innloggede brukere kan lese produktkatalog (ikke tenant-data) |
| **Anbefalt retning** | Dokumenter som tilsiktet; vurder om anon bør blokkeres eksplisitt (allerede via RLS default) |

---

### RLS-002 — Tabeller med RLS ON men 0 policies (52 tabeller)

| Felt | Verdi |
|------|-------|
| **Alvorlighet** | 🟡 Middels |
| **Status** | Bekreftet, stort sett tilsiktet |
| **System** | Supabase RLS |
| **Tittel** | 52 tabeller har RLS aktivert uten eksplisitte policies → default deny for JWT-roller |
| **Bevis** | Golden snapshot: `company_invites`, `employee_invites`, `audit_log_y*` partitions, `memberships`, `organizations`, `webhook_events`, etc. |
| **Konsekvens** | Sikker default-deny; tilgang kun via service_role eller SECURITY DEFINER |
| **Unntak å verifisere** | `menu_visibility_days` — RLS ON, 0 policies, uklart authenticated path (OPEN-QUESTIONS.md) |

---

### RLS-003 — `lp_billing_*` RPCs granted til authenticated

| Felt | Verdi |
|------|-------|
| **Alvorlighet** | 🟡 Middels |
| **Status** | Sannsynlig sikker (krever funksjons-review) |
| **System** | Supabase RPC |
| **Tittel** | 10+ billing RPCs har `GRANT EXECUTE TO authenticated, service_role` |
| **Bevis** | `20260729120000_global_billing_engine_foundation.sql:1319-1323`, `20260802120000_payment_invoice_readiness_policy.sql:278` |
| **Konsekvens** | Auth må håndheves inne i SECURITY DEFINER kropp |
| **Anbefalt retning** | Manuell review av hver `lp_billing_*` for `auth.uid()` + tenant-sjekk |

---

### RLS-004 — Identity spine: service_role only tables

| Felt | Verdi |
|------|-------|
| **Alvorlighet** | 🟡 Middels (positivt funn) |
| **Status** | Bekreftet |
| **System** | Supabase RLS |
| **Tittel** | `organizations`, `memberships`, `platform_admins` — FORCE RLS + REVOKE fra anon/authenticated |
| **Bevis** | `20260703120000_fundament_identity_spine_phase1.sql:425-438` |
| **Konsekvens** | Fail-closed; kun service_role og SD-funksjoner |

---

### NEXT-002 — `lib/types/database.ts` løs typing

| Felt | Verdi |
|------|-------|
| **Alvorlighet** | 🟡 Middels |
| **Status** | Bekreftet |
| **System** | Next.js types |
| **Tittel** | 136 tabeller listet; kun 5 har strict typing, resten `LoosePublicTable` |
| **Bevis** | `lib/types/database.ts:1-5`, `:19-27`, `:233-386` |
| **Konsekvens** | Compile-time skjuler schema-drift; RLS er fortsatt autoritativ |

---

### NEXT-003 — 16 cron-ruter uten Vercel schedule

| Felt | Verdi |
|------|-------|
| **Alvorlighet** | 🟡 Middels |
| **Status** | Bekreftet |
| **System** | Vercel cron |
| **Tittel** | 29 cron route-filer; kun 13 i `vercel.json` |
| **Bevis** | `vercel.json:3-16` (13 entries) vs `app/api/cron/` (29 filer). Allowlist inkluderer alle 29 (`apiAllowlist.ts:26-54`) |
| **Konsekvens** | Cron-ruter som `system-motor`, `social`, `revenue` kjører kun ved manuell trigger eller ekstern scheduler |

---

### CI-001 — CODEOWNERS placeholder

| Felt | Verdi |
|------|-------|
| **Alvorlighet** | 🟡 Middels |
| **Status** | Bekreftet |
| **Bevis** | `.github/CODEOWNERS` — `@your-org/your-team` placeholder |

---

### CI-001 — Docs-only PRs skipper CI

| Felt | Verdi |
|------|-------|
| **Alvorlighet** | 🟡 Middels |
| **Status** | Bekreftet, dokumentert trade-off |
| **Bevis** | `docs/architecture/monorepo.md:165-167`, `ci.yml` path filters |

---

## 3. RLS-matrise (oppsummering)

**Full autoritativ snapshot:** `tests/rls/golden-rls-snapshot.json` (100 policies, 100 RLS-enabled tables, 2026-07-02).

### Oppsummering per kategori

| Kategori | Tabeller | RLS | Policies | Tenant-nøkkel | Risiko |
|----------|----------|-----|----------|---------------|--------|
| Ordre | `orders`, `order_items`, `order_status_history` | ON | 4-6 each | `company_id`, `provider_id` via helpers | ⚪ |
| Selskap | `companies`, `company_locations`, `profiles` | ON | 4-6 each | `company_id` | ⚪ |
| Avtaler | `agreements`, `agreement_*` | ON | 2-6 each | `company_id` | ⚪ |
| Meny (materialisert) | `menu_service_days`, `menu_service_day_items` | ON | 4 each | `provider_id` | ⚪ |
| Fakturering (baseline) | `invoice_periods`, `tripletex_exports` | ON | 1 each | `company_id` / join | ⚪ |
| Billing catalog | `billing_products`, `billing_tax_codes` | ON | 1 each (open SELECT) | N/A | 🟡 |
| Audit | `audit_log` + 39 partitions | ON+FORCE | 0 (revoked) | N/A | ⚪ (hardened) |
| Invites | `company_invites`, `employee_invites` | ON | 0 | service_role only | ⚪ |
| Identity spine | `organizations`, `memberships`, `platform_admins` | ON+FORCE | 0 | service_role only | ⚪ |
| PII | `leads`, `lp_user_allergens` | ON | 1-5 | self / service_role | ⚪ |
| Webhooks | `webhook_events`, `tripletex_webhook_events` | ON | 0 | service_role only | ⚪ |
| CMS (backoffice) | `content_pages`, `content_page_variants` | ON | scoped | backoffice role | 🟡 |

### Post-golden RLS (migrasjoner 20260729–20260810) — lokalt bekreftet

**Golden snapshot:** `2026-07-02` — dekker **ikke** billing engine.

| Schema.Table | Migrasjon | Policies | Tenant-nøkkel |
|--------------|-----------|----------|---------------|
| `markets` | `20260729120000` | 3 (open SELECT auth, service_role ALL, platform_admin ALL) | global |
| `organization_billing_profiles` | `20260729120000` | 2 | `lp_billing_can_access_provider(organization_id)` |
| `payment_methods` | `20260729120000` | 2 | org-scoped |
| `order_line_commercial_snapshots` | `20260729120000` | 2 | `provider_id` |
| `commission_rules` | `20260729120000` | 3 | open SELECT + admin |
| `commission_ledger` | `20260729120000` | 3 | provider SELECT + inserts |
| `commission_periods` | `20260729120000` | 3 | provider-scoped |
| `provider_commission_invoices` | `20260729120000` | 3 | provider-scoped |
| `invoice_deliveries` | `20260729120000` | 3 | via invoice join |
| `billing_audit_log` | `20260729120000` | 3 | platform_admin / service_role |
| `billing_readiness_events` | `20260731120000` | 3 | provider + platform_admin |
| `stripe_billing_webhook_events` | `20260803120000` | 2 | platform_admin SELECT; service_role ALL |
| `billing_payment_attempts` | `20260807120000` | 2 | platform_admin SELECT; service_role ALL |

**Hosted produksjonsstatus:** ikke verifisert — `rls-drift-check.yml` vil flagge drift mot golden.

**Bevis:** `20260729120000_global_billing_engine_foundation.sql:1132-1277` (27 policies); subagent migrasjonsinventar (61 filer lest).

### Eksempel: `orders` (6 policies)

| Policy | Command | USING (kort) | Bevis |
|--------|---------|--------------|-------|
| `orders_select_scoped` | SELECT | `can_view_order(id)` | golden snapshot |
| `orders_insert_scoped` | INSERT | `can_edit_order(...)` WITH CHECK | golden snapshot |
| `orders_update_scoped` | UPDATE | `can_edit_order(id)` | golden snapshot |
| `orders_delete_scoped` | DELETE | `can_edit_order(id)` | golden snapshot |
| + platform admin variants | ALL/SELECT | `is_platform_admin()` | golden snapshot |

### Kritiske RLS-hardening (historikk, bekreftet aktiv)

| Hendelse | Migrasjon | Fix |
|----------|-----------|-----|
| Audit partition lekkasje | `20260616120000_audit_log_partition_rls_harden.sql` | FORCE RLS + REVOKE på alle partitions |
| Internal RPC eksponering | `20260609150000_revoke_internal_rpc_execute_lockdown.sql` | REVOKE EXECUTE fra PUBLIC/anon/authenticated |
| Billing RLS | `20260609120000_dc018` + `20260609130000_dc019` | Tenant-scoped invoice/tripletex |

---

## 4. Databaseprivilegier

### Roller og grants (effektiv modell)

| Rolle | Schema access | RLS | Typisk bruk |
|-------|---------------|-----|-------------|
| `anon` | `public` via PostgREST | Respektert | Offentlige endepunkter (allowlisted) |
| `authenticated` | `public` via PostgREST | Respektert | Innloggede brukere (JWT) |
| `service_role` | `public` | **Bypasses RLS** | Server-only via `supabaseAdmin()` |
| `supabase_auth_admin` | `custom_access_token_hook` | N/A | Auth hook only |
| `postgres` | Full | Superuser | Migrasjoner |

### Private schema

- **38 SECURITY DEFINER funksjoner** i `private.*` (golden snapshot)
- **Ikke eksponert** via PostgREST (`config.toml:13` — kun `public`, `graphql_public`)
- Nøkkelfunksjoner: `can_access_company`, `can_view_order`, `is_platform_admin`, `audit_log_harden_relation`

### Internal RPC lockdown

**Bevis:** `20260609150000_revoke_internal_rpc_execute_lockdown.sql:27-68`
- Revoker fra: `PUBLIC`, `anon`, `authenticated`
- Re-granter til: `service_role`, `postgres`
- Mønstre: `tg_*`, `trg_*`, `outbox_*`, `handle_new_user`, `lp_idem_*`

---

## 5. Rolle- og tenantmodell

### Database vs Next.js sammenligning

| Rolle | DB (`user_role` enum) | Next.js (`lib/auth/role.ts`) | Middleware | RLS helpers | Avvik |
|-------|------------------------|-------------------------------|------------|-------------|-------|
| superadmin | `superadmin` | `superadmin` | Session only | `is_platform_admin()` | ⚪ Ingen |
| company_admin | `company_admin` | `company_admin` | Session only | `can_admin_company()` | ⚪ Ingen |
| employee | `employee` | `employee` | Session only | `can_access_company()` | ⚪ Ingen |
| kitchen | `kitchen` | `kitchen` | Session only | `can_kitchen_location()` | ⚪ Ingen |
| driver | `driver` | `driver` | Session only | `can_access_location()` | ⚪ Ingen |
| provider_* | via `provider_memberships.role` | `provider_admin/kitchen/viewer` | Session only | `lp_assert_provider_kitchen_access` | ⚪ Ingen |
| company_finance | `company_finance` | `company_finance` | Session only | `can_finance_company()` | ⚪ Ingen |
| location_admin | `location_admin` | `location_admin` | Session only | `can_admin_location()` | ⚪ Ingen |

### Tenant-identifikasjon

| Kilde | Validering | Klientstyrt? |
|-------|------------|--------------|
| `profiles.company_id` | Server-side `getAuthContext()` | ❌ Aldri fra klient |
| `profiles.location_id` | Server-side | ❌ |
| `provider_memberships.provider_id` | `canAccessProvider()` | ❌ |
| JWT claims (auth hook) | Shadow mode (`20260708120000`) | Funksjon deployet hosted; Auth enable uavklart |

**Bevis:** `lib/auth/getAuthContext.ts:516-533` (provider fail-closed), `AGENTS.md` C3 (aldri trust client `company_id`)

---

## 6. RPC- og SECURITY DEFINER-audit

### Høyrisiko RPCs

| Funksjon | Grant | Auth-sjekk | Bevis |
|----------|-------|------------|-------|
| `lp_order_set` | authenticated | Provider/company scope in-body | `20260611120000:7-8` |
| `lp_order_advance_status` | authenticated | Provider kitchen + cutoff GUC | `20260616110410_*`, `20260730120000:395+` |
| `lp_company_suspend/pause/delete/resume` | authenticated | Superadmin/provider gate | `20260618120000:8-126` |
| `custom_access_token_hook` | supabase_auth_admin only | Auth pipeline | `20260708120000:205-208` |
| `lp_capture_lead` | service_role only | Fail-closed PII | `20260702120000:82-194` |
| `lp_billing_*` (10+) | authenticated + service_role | In-function (review needed) | `20260729120000:1319+` |

### Auth hook (identity spine phase 2)

| Aspekt | Verdi |
|--------|-------|
| Funksjon | `custom_access_token_hook` |
| Grant | Kun `supabase_auth_admin` (+ `postgres`, `service_role` på hosted) |
| Lokal config | Enabled (`supabase/config.toml:263-265`) |
| Hosted funksjon | **Bekreftet** — `public.custom_access_token_hook`, SECURITY DEFINER, `search_path=public` (MCP 2026-07-11) |
| Hosted Auth enable | **Uavklart** — ikke lesbar via MCP/SQL; migrasjon sier eksplisitt «Does NOT enable Auth hook» |
| JWT claims verifisert | **Nei** — forventet ved aktivering: `active_org_id`, `active_role`, `is_platform_admin`, `active_location_id` |

---

## 7. Storage-audit

**Supabase Storage (hosted prod, MCP 2026-07-11):** Bucket `provider-logos` · **public read** (tilsiktet) · 2 MiB · `image/png`, `image/webp` · **0 storage policies**.

| Operasjon | Offentlig | Rolle | Tenantkontroll | Mekanisme | Risiko |
|-----------|----------:|-------|----------------|-----------|--------|
| Read | Ja | Alle | Public bucket | Supabase CDN URL | Lav (tilsiktet logo-visning) |
| Upload | Nei | `provider_admin` | `providers/{providerId}/logo-{uuid}.ext` | Server action `saveProviderLogo` + **service role** | Lav gitt server-side gate |
| Update | Nei | Samme | Ny fil + slett gammel | Server action | Lav |
| Delete | Nei | `provider_admin` | Path må starte `providers/` | `removeProviderLogo` + service role | Lav |

**0 policies** er **ikke** automatisk lekkasje — all skriving går via beskyttet server action, ikke browser-klient.

**Lokalt:** Ingen dedikerte bucket-migrasjoner i aktiv migrasjonskjede. Media for backoffice håndteres via `app/api/backoffice/media/` og egne tabeller (`media_items` i baseline).

**Azure Blob (Umbraco):** `Program.cs:10-11` — `AddAzureBlobMediaFileSystem()`. Path: `media/<hash>/<filename>`. Credentials i Azure App Service config (ikke i repo).

---

## 8. Edge Functions

**Status:** Ingen Supabase Edge Functions deployet.

**Bevis:** `supabase/functions/` eksisterer ikke. `config.toml:354` har `[edge_runtime].enabled = true` (lokal dev only).

Cron og webhooks kjøres som **Next.js API routes** på Vercel, ikke som Deno edge functions.

---

## 9. Next.js-sikkerhet

### Middleware (DC-011)

| Kontroll | Status | Bevis |
|----------|--------|-------|
| Fail-closed API | ✅ | `middleware.ts:111-138` |
| Explicit allowlist (86 entries) | ✅ | `apiAllowlist.ts:9-124` |
| No wildcards in Set | ✅ | Dynamic patterns dokumentert |
| No role in middleware | ✅ By design | `middleware.ts:157-161` |
| `/umbraco` isolation | ✅ | `middleware.ts:95-104` |
| Login loop prevention | ✅ | `role.ts:79-99`, AGENTS.md E5 |

### Service role boundary

| Kontroll | Status | Bevis |
|----------|--------|-------|
| Single read point | ✅ | `lib/supabase/admin.ts:45-48` |
| `server-only` import | ✅ | `lib/supabase/admin.ts:2` |
| Never in middleware/browser | ✅ | Comment L20-22 |

### Webhook-sikkerhet

| Webhook | Allowlisted | Signatur | Bevis |
|---------|-------------|----------|-------|
| Sanity menu-day | ✅ | `SANITY_WEBHOOK_SECRET` | `app/api/webhooks/sanity/menu-day/route.ts:46-57` |
| Tripletex | ✅ | HMAC | `app/api/webhooks/tripletex/route.ts` |
| Tripletex provider | ✅ (dynamic) | Per-provider | `apiAllowlist.ts:106` |
| Stripe SaaS | ✅ | Stripe sig | `app/api/saas/billing/webhook/route.ts` |
| Stripe provider pay | ❌ | Stripe sig | SEC-001 |
| Stripe provider setup | ❌ | Stripe sig | SEC-001 |

### Cron-sikkerhet

Alle cron-ruter: `requireCronAuth()` med `CRON_SECRET` (Bearer eller `x-cron-secret`). Testet: `tests/security/dc011-route-fixes.test.ts:94-106`.

### Caching

Bruker-spesifikke data: `dynamic = "force-dynamic"` på kritiske ruter. Ingen bekreftet cache-lekkasje funnet (krever runtime-verifisering for RSC payload).

---

## 10. Secrets

### Scan-resultat (maskert)

| Type | Fil | Status |
|------|-----|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Env-referanser only | ✅ Ikke hardkodet i tracked source |
| `SANITY_WRITE_TOKEN` | `lib/sanity/server.ts`, CI secrets | ✅ Server-only |
| PEM private keys | `scripts/audit/e1-git-secrets-scan.mjs:12` (scanner pattern) | ✅ Ingen funn i tracked files |
| `.env.local` | Gitignored | ✅ Ikke tracked |
| Untracked `.env.preview.verify` | Working tree | ⚠️ Ikke committet (OK) |

### NEXT_PUBLIC_* (klienteksponert)

| Variabel | Sensitiv? | Bevis |
|----------|-----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Lav | Forventet |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Lav (RLS-beskyttet) | Forventet |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Lav | Forventet |
| `NEXT_PUBLIC_SANITY_DATASET` | Lav | Forventet |

**Ingen** `NEXT_PUBLIC_*` service role eller write token funnet.

---

## 11. CI/CD-sikkerhet

### GitHub workflows — sikkerhetsvurdering

| Workflow | Risiko | Bevis |
|----------|--------|-------|
| `ci.yml` | ⚪ Lav | Path-filtered; secrets via GitHub Environments |
| `supabase-migrate.yml` | 🟡 Middels | DB write til staging; krever secrets |
| `codex-audit-autofix.yml` | 🟡 Middels | Autonom kodeendring bot |
| `auto-engineer.yml` | 🟡 Middels | Dispatch-only |
| `main_lunchportalen-umbraco.yml` | ⚪ Lav | OIDC til Azure; path-filtered |
| `rls-drift-check.yml` | ⚪ Lav | Read-only prod |

**Ingen** `pull_request_target` med checkout av uverifisert kode funnet.

**Ingen** `permissions: write-all` funnet.

### Vercel miljøisolasjon (oppdatert 2026-07-11)

Staging har egen `SUPABASE_*` + `SANITY_*` i custom env `staging`. Production Supabase-ref `hkpokyapzarefrgqzkos` bekreftet i deployert HTML. Preview deler env-scope med Production for `NEXT_PUBLIC_SUPABASE_URL` → **delvis separert** (staging isolert; preview sannsynlig delt med prod).

---

## 12. Hosted prod-verifisering (MCP 2026-07-11)

| Objekt | Lokalt | Hosted prod | Drift | Bevis |
|--------|--------|-------------|-------|-------|
| Migrasjoner | 61 | 49 | Prod −12 (alle fremtidsdaterte billing) | `list_migrations` |
| Billing-tabeller (`20260729` blokk) | 12 tabeller | **0** | **12** | `information_schema` 2026-07-11 |
| `lp_billing_*` RPC-er | Ja (lokal) | **0** | Ja (staging) | `pg_proc` |
| `20260810120000` objekt | `tg_menu_service_day_item_snapshot` | **Finnes** | Finnes | Migrasjonshull i historikk, ikke i schema |
| Public-tabeller RLS | Alle tenant-tabeller | 147/147 `rls_enabled` | — | `execute_sql` |
| FORCE RLS | `audit_log` + utvalg | 45 tabeller force | `orders` uten FORCE | `execute_sql` |
| SECURITY DEFINER (public) | 112+ (lokal) | 112 | — | `execute_sql` count |
| `custom_access_token_hook` | Ja + config enabled | Funksjon + grants OK | Auth enable uavklart | `execute_sql` |
| Storage bucket | — | `provider-logos` public | 0 storage policies | `execute_sql` |

**Staging branch** `uigxsboqeruxflgzqztl`: 61 migrasjoner (matcher lokal); branch-metadata `MIGRATIONS_FAILED`.

---

## 13. Uverifiserte områder

| Område | Status | Årsak |
|--------|--------|-------|
| Supabase Auth hook Dashboard enable | Uavklart | Ikke lesbar via MCP/SQL |
| Full hosted schema-drift (views, triggers, enums) | Delvis | Kun utvalgte SQL-prøver |
| Storage tenant policies | Ikke funnet | 0 policies på `storage` |
| Vercel Sanity-dataset per scope | Uavklart | Verdier kryptert |
| Vercel deployment protection | Uavklart | Ikke i CLI-output |
| Azure App Insights / Key Vault | Ikke funnet | RG-søk + CLI |
| Azure deployhistorikk | Delvis | Siste success 2026-06-21 OneDeploy (`az webapp log deployment list`) |
| Azure Log Analytics workspace | Ingen i RG | `az monitor log-analytics workspace list` → `[]` |
| Azure App Service managed identity | Inaktiv | `az webapp identity show` → null |
| Stripe Dashboard webhook URLs | Ukjent | Ekstern konfigurasjon |
| Penetrasjonstest | Ikke utført | Utenfor read-only scope |

Se [OPEN-QUESTIONS.md](./OPEN-QUESTIONS.md) for full liste og anbefalt neste verifikasjon.
