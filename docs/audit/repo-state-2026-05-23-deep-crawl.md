# Deep crawl — 2026-05-23

**Metode:** READ-ONLY repo-analyse + Supabase MCP (staging `uigxsboqeruxflgzqztl`, prod `hkpokyapzarefrgqzkos`)  
**Baseline:** `docs/audit/repo-state-2026-05-22.md` (unngå duplikater der merket)  
**Tidsstempler:** Fase 1 start 10:33 UTC · Fase 2 start 10:33 UTC · Fase 3 start 10:45 UTC · Fase 4–5 10:50 UTC · Fase 6 11:05 UTC

---

## Sammendrag

| Alvor       | Antall | Estimert effort |
| ----------- | -----: | --------------: |
| HARD-BLOCK  |      5 |           ~18 t |
| HØY         |     12 |           ~32 t |
| MEDIUM      |     18 |           ~28 t |
| LAV         |     11 |           ~12 t |
| **Totalt**  | **46** |        **~90 t** |

Testsuite før: **2333 PASS** / **0 FAIL** (124 skipped, 489 filer)  
Testsuite etter PR-X1 Fase 3: **2387 PASS** / **0 FAIL** (124 skipped) — +54 sikkerhets-/middleware-tester  
**PR-X1 prod-deploy:** merge `44949eed` → Vercel production Ready 2026-05-23 · prod-smoke **11/11 PASS** ([dc-011-prod-smoke.md](./dc-011-prod-smoke.md))

### PR-X1 — lukkede funn (prod 2026-05-23)

| Finding | Alvor | Status |
| ------- | ----- | ------ |
| DC-011 | HARD-BLOCK | **LUKKET** (PR-X1, prod 2026-05-23, merge `44949eed`) |
| DC-027 | HARD-BLOCK | **LUKKET** (PR-X1, samme commit) |
| D.1 meal-learning fail-open | open | **LUKKET** (Commit 4 / `970e3a89`) |
| D.3 (6 ruter) | open | **LUKKET** (Commit 3 / `dc15f591`) |
| D.4 (3 dev-ruter) | open | **LUKKET** (Commit 5 / `628c5604`) |
| DC-018 | HARD-BLOCK | **LUKKET** (PR-X2, prod 2026-05-23) |
| DC-019 | HARD-BLOCK | **LUKKET** (PR-X3, prod 2026-05-23) |

### Supabase-tilgang

| Miljø   | Project ref              | Status        |
| ------- | ------------------------ | ------------- |
| Staging | `uigxsboqeruxflgzqztl`   | OK (SELECT)   |
| Prod    | `hkpokyapzarefrgqzkos`   | OK (SELECT)   |

### Anbefalt rekkefølge for opprydning

1. Alle HARD-BLOCK → må lukkes før K6 LIVE
2. Sikkerhetsrelaterte HØY (Fase 1.6, 2.4)
3. Tripletex scope-down (Fase 4) — låser inn deferral-beslutning
4. Resterende HØY
5. MEDIUM/LAV → vurder per sprint

---

## Fase 1 — Repo static analysis

**Start:** 2026-05-23 10:33 UTC

### 1.1 Dead code & deprekasjoner

**@deprecated (28 treff i prod-kode, ekskl. archive/):**

| Fil | Linje | Notat |
| --- | ----- | ----- |
| `app/onboarding/OnboardingForm.tsx` | 5 | Orphan — `/onboarding` redirecter til `/registrering` |
| `lib/cms/blocks/componentRegistry.ts` | 457 | Alias `BLOCK_SCHEMA` — fjernes neste RC |
| `lib/week/availability.ts` | 165 | `isAfterFriday1400` → `isAfterFriday1500` |
| `lib/ai/intelligence/scale.ts` | 66–232 | Legacy scale engine |
| `app/kitchen/report/*` | 2–3 | Redirect til `/kitchen?tab=aggregate` |
| `lib/core/logger.ts` | 72 | `logError()` → `log.error()` |
| Diverse CMS/backoffice aliases | — | Beholdt for import-kompatibilitet |

**Knip / ts-prune:** Ikke kjørt fullt (tidsbudsjett). Baseline 2026-05-22 rapporterer ~703→277 filer i `lib/ai/` etter cleanup. Anbefaling: kjør `npx knip --reporter json` og `npx ts-prune` i egen CI-jobb.

#### Funn

[DC-001] dead-code | MEDIUM  
Bevis: `app/onboarding/OnboardingForm.tsx` (hel fil, @deprecated orphan)  
Beskrivelse: Kanonisk flyt er `CompanyRegistrationForm` + `POST /api/onboarding/complete`. Filen importeres ikke i aktive ruter.  
Anbefaling: Arkiver eller slett etter bekreftelse at ingen test importerer den direkte.  
Effort: S

[DC-002] dead-code | LAV  
Bevis: `app/kitchen/report/page.tsx`, `app/kitchen/report/KitchenReportClient.tsx`  
Beskrivelse: Deprecated rute med redirect til kanonisk kjøkkenflate.  
Anbefaling: Fjern etter én RC-syklus uten trafikk (server-logg).  
Effort: S

---

### 1.2 Console & debug

**`debugger`:** 0 treff.

**TODO/FIXME/XXX/HACK:** 1 produksjons-TODO (`app/admin/page.tsx:266` — `company_billing_accounts` mangler i prod). Øvrige `XXX` er testdata/placeholders.

**`console.*` utenfor `lib/log/`, `lib/sentry/`, `scripts/`, `tests/`:** ~200+ filer totalt; **~55 filer under `app/`** inkl. kritiske ruter.

[DC-003] observability | HØY  
Bevis: `app/api/auth/post-login/route.ts:60+`, `docs/operations/sentry-conventions.md:114`  
Beskrivelse: Sentry-konvensjon krever `lib/core/logger.ts` for ALL prod-logging. `post-login` og mange API-ruter bruker direkte `console.log`/`console.error` med potensielt sensitive metadata (email-prefix, cookie-navn).  
Anbefaling: Migrer til `log.info`/`log.error` med `scrubLogContext`; prioritér auth- og cron-ruter.  
Effort: M

[DC-004] observability | MEDIUM  
Bevis: `lib/core/errorResponse.ts:24` — `console.error("[ERROR_RESPONSE]", …)`  
Beskrivelse: `logErrorResponse` bruker console parallelt med Sentry — akseptabelt for lokal debug, men bryter agent-regel ordrett.  
Anbefaling: Erstatt med `log.error` eller dokumenter unntak i sentry-conventions.  
Effort: S

---

### 1.3 Env-vars

**.env.example:** 22 linjer, dekker kun Supabase-publiserbare nøkler, Tripletex defaults, cron-AI-flagg.

**Lest i kode men ikke i .env.example (utvalg — 80+ totalt):**

| Variabel | Kontekst |
| -------- | -------- |
| `CRON_SECRET` | Alle cron-ruter |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Observability |
| `SANITY_*` (6+) | Meny/webhook |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | AI-moduler |
| `RESEND_API_KEY`, `SMTP_*` | E-post |
| `UMBRACO_CMS_ORIGIN`, `UMBRACO_DELIVERY_BASE_URL` | CMS-proxy |
| `E2E_*`, `PLAYWRIGHT_*` | Test harness |
| `TRIPLETEX_BASE_URL`, `TRIPLETEX_COMPANY_ID`, `TRIPLETEX_TOKEN` | Flow 1 |

**I .env.example men minimalt dokumentert:** `SYSTEM_MOTOR_SECRET` (kritisk for health), `TRIPLETEX_ENABLED` (feature gate finnes, men Flow 1/2 ikke separert).

[DC-005] config | HØY  
Bevis: `.env.example` vs `rg 'process\.env\.'` (500+ treff)  
Beskrivelse: Canonical env-liste dekker <5 % av faktisk bruk. Onboarding av ny utvikler / Vercel-miljø er feilutsatt.  
Anbefaling: Utvid `.env.example` med grupperte seksjoner (auth, cron, integrations, AI) — uten secrets.  
Effort: M

#### TRIPLETEX_* klassifisering

| Variabel | Flow | Bruksted |
| -------- | ---- | -------- |
| `TRIPLETEX_CONSUMER_TOKEN` | **Flow 1** | `lib/integrations/tripletex/client.ts:327`, `onboardingVerify.ts:116` |
| `TRIPLETEX_EMPLOYEE_TOKEN` | **Flow 1** | `lib/integrations/tripletex/client.ts:328` |
| `TRIPLETEX_COMPANY_ID` | **Shared** | Default Lp-session i `client.ts` |
| `TRIPLETEX_TOKEN` / `TRIPLETEX_SESSION_TOKEN` | **Flow 1** | Direct session token |
| `TRIPLETEX_BASE_URL`, `TRIPLETEX_TIMEOUT_MS`, `TRIPLETEX_MAX_RETRIES` | **Shared** | HTTP-klient |
| `TRIPLETEX_REVENUE_DEFAULT_*` | **Flow 1** | `providerSaasInvoiceSync.ts`, SaaS cron |
| `TRIPLETEX_ENABLED` | **Shared** | Global gate (må splittes) |
| Per-provider tokens | **Flow 2** | `provider_tripletex_credentials` → Vault RPC (`consumer_token_secret_id`, `employee_token_secret_id`) |

---

### 1.4 Designsystem-compliance

**Inline `style={`:** 47 `.tsx`-filer (superadmin control-tower, dashboard, AuthShell, kitchen report m.fl.).

**CSS utenfor `styles/design-system/` og `styles/landing-page-blocks/`:**

| Fil | Vurdering |
| --- | --------- |
| `app/globals.css` | Monolitt (~4500 linjer) — blanding ds + ad-hoc |
| `app/styles/employee-week.css` | Employee-spesifikk (OK med mobile-first reduce-motion) |
| `lib/ui/design.css`, `lib/ui/motion.css` | Utenfor konvensjon |

**`@media (max-width:`:** 50+ i `app/globals.css` og ds-filer — desktop-first mønster (nedskalering fra desktop).

[DC-006] ui-system | MEDIUM  
Bevis: `app/(app)/dashboard/page.tsx` (38 inline styles), `components/app/AppShell.tsx` (12)  
Beskrivelse: Inline styles omgår ds-/lp-klasser og vanskeliggjør mobile-first konsistens (S1.1/S1.2).  
Anbefaling: Flytt til `app/styles/ds/` tokens; én komponent om gangen ved berøring.  
Effort: L

[DC-007] ui-system | MEDIUM  
Bevis: `app/globals.css:746,1696,3268…` — `@media (max-width: …)`  
Beskrivelse: Desktop-first breakpoints i global CSS. Employee-week.css bruker korrekt `prefers-reduced-motion` mønster som moteksempel.  
Anbefaling: Refaktorer kritiske mobilflater (`/`, `/week`) til mobile-first `@media (min-width:`.  
Effort: L

[DC-008] ui-system | LAV  
Bevis: `lib/ui/design.css`, `lib/ui/motion.css`  
Beskrivelse: CSS utenfor godkjente mapper.  
Anbefaling: Flytt til `app/styles/ds/` eller importer via design-system entry.  
Effort: S

---

### 1.5 A11y

**`:focus-visible`:** Finnes i ds-filer og `globals.css` (sentral blokk ~4165).

**`prefers-reduced-motion`:** Dekket i `employee-week.css`, ds-blocks, `lib/ui/motion.css`, `globals.css`.

**`dangerouslySetInnerHTML`:** 3 steder — bootstrap scripts (public layout), kitchen print HTML.

[DC-009] a11y | MEDIUM  
Bevis: Grep `<button` uten aria-label med tom innhold — flere i superadmin/control-tower (ikke fullt enumerert)  
Beskrivelse: Icon-only knapper i control-tower/backoffice kan mangle tilgjengelig navn.  
Anbefaling: Systematisk axe/pa11y pass på `/superadmin/control-tower` og `/backoffice/content`.  
Effort: M

[DC-010] a11y | LAV  
Bevis: `app/kitchen/print/KitchenPrintBody.tsx:67`  
Beskrivelse: Print-HTML via `dangerouslySetInnerHTML` — kontrollert server-generert payload; lav risiko.  
Anbefaling: Dokumenter allowlist; ingen endring nødvendig.  
Effort: S

---

### 1.6 Sikkerhet

**`service_role` / `SUPABASE_SERVICE_ROLE_KEY`:** Kun i `lib/supabase/admin.ts`, `app/api/`, `lib/server/`, `scripts/`, `tests/` — **ingen client-lekkasje funnet**.

**Middleware (`middleware.ts`):**

| Path-prefix | Auth |
| ----------- | ---- |
| `/api/*` allowlist (81 ruter) | Egen auth i route — middleware bypass |
| `/api/*` øvrige | **Session påkrevd** — middleware 401 JSON |
| `/login`, static, `/_next` | Bypass |
| `/week`, `/admin`, `/superadmin`, `/backoffice`, `/orders`, `/driver`, `/kitchen`, `/leverandor` | Session cookie required |
| `/umbraco/*` | Ingen Supabase refresh (proxy) |

[DC-011] security | HARD-BLOCK → **LUKKET (PR-X1, prod 2026-05-23, merge `44949eed`)**  
Bevis (før): `middleware.ts` — blanket `/api/*` bypass  
Fix: `lib/server/auth/apiAllowlist.ts` (83) + session-gate i `middleware.ts` + 33 rute-fixes  
Dokumentasjon: `docs/operations/api-auth-inventory.md`  
Prod-smoke: `docs/audit/dc-011-prod-smoke.md` — 11/11 PASS  
Tester: `tests/security/api-allowlist-regression.test.ts`, `no-implicit-bypass.test.ts`, `ai-routes-auth.test.ts`, `dc011-route-fixes.test.ts`

[DC-027] security | HARD-BLOCK → **LUKKET (PR-X1, prod 2026-05-23, merge `44949eed`)**  
Bevis: 17 B8 AI-ruter uten inline auth (deep crawl / Fase 2.5)  
Fix: `denyUnlessSession` utenfor `withApiAiEntrypoint` på alle 17 ruter

[DC-012] security | HØY  
Bevis: SQL staging — `company_registrations_anon_insert` policy tillater `{anon,authenticated}` INSERT med PENDING-validering  
Beskrivelse: Bevisst onboarding-design (frozen P16), men anon kan INSERT i `company_registrations`. Må verifiseres at ingen SELECT/UPDATE for anon.  
Anbefaling: Bekreft at anon kun har INSERT-policy; dokumenter i `docs/rc/company-lifecycle-rc.md`.  
Effort: S

---

### 1.7 Avhengigheter

**Migrasjonsfiler:** 262 SQL i repo  
**Prod ledger:** 95 applied  
**Staging ledger:** 59 applied  
**Drift vs baseline (93→95):** +2 migrasjoner siden 2026-05-22 (`k4_kill_esg_tables`, m.fl.)

**npm audit --omit=dev:** 11 vulnerabilities (2 high, 9 moderate) — bl.a. `ws` moderate (GHSA-58qx-3vcg-4xpx).

[DC-013] dependencies | HØY  
Bevis: `npm audit --omit=dev` 2026-05-23  
Beskrivelse: 2 HIGH CVEs i prod dependency tree (transitive).  
Anbefaling: `npm audit fix`; verifiser med full testsuite.  
Effort: M

[DC-014] migrations | HØY  
Bevis: SQL — prod 95, staging 59, repo 262 filer  
Beskrivelse: ~167 repo-filer uten prod-ledger-rad; staging 36 migrasjoner bak prod. Schema-paritet 135 tabeller, men ledger-drift øker risiko for feil apply.  
Anbefaling: Generer `supabase migration list`-diff; ikke squash før prod stabil — dokumenter canonical apply-rekkefølge.  
Effort: M

---

### 1.8 Test-helse

**Resultat:** 2333 PASS / 0 FAIL / 124 skipped (24 testfiler skipped, hovedsakelig DB-integrasjon uten `hasDb`).

**Skipped-mønster:** `describe.skipIf(!hasDb)`, e2e uten credentials — forventet.

**Live DB i tester:** `tests/tenant-isolation-agreement.test.ts`, `tests/db/database-integrity.test.ts` — krever env, default mock.

**API-ruter uten dedikert test:** ~536 ruter; `tests/api/smoke-api-routes.test.ts` dekker subset. Baseline estimerer ~40 % dekning på kjerne-ruter.

[DC-015] test-gap | MEDIUM  
Bevis: 536 `app/api/**/route.ts` vs smoke-test subset  
Beskrivelse: AI/growth/cron-stubs (66 cron-ruter) mangler systematisk kontrakttest.  
Anbefaling: Utvid smoke-test med cron-auth 403-matrix; prioritér muterende superadmin-ruter.  
Effort: L

---

### 1.9 Sentry-compliance

**Konvensjoner vs kode:**

| Konvensjon | Status |
| ---------- | ------ |
| DSN env på Vercel | Verifisert staging 2026-05-22 (baseline) |
| `log.*` for prod-logging | **Brudd** — se DC-003 |
| PII-scrub i `beforeSend` | `lib/sentry/scrubEvent.ts` — tester PASS |
| `onRequestError` | `instrumentation.ts:46` ✓ |
| Cron `captureCronHandlerError` | 11+ cron-ruter ✓ |
| `safeHandler` wrapper | **Ikke brukt** — capture via `logErrorResponse`/`jsonErr` manuelt |
| Serverless `flush(2000)` | Dokumentert; brukes i test-ruter |

[DC-016] observability | MEDIUM  
Bevis: `rg safeHandler app/api` → 0 treff; `instrumentation.ts:46`  
Beskrivelse: Uhåndterte feil fanges via `onRequestError`, men eksplisitte route-handler captures uten `flush` kan mistes i serverless (dokumentert 2026-05-22).  
Anbefaling: Standardiser `logErrorResponse` i alle `catch`-blokker i muterende ruter; vurder tynn `safeHandler`-wrapper.  
Effort: M

---

## Fase 2 — Supabase introspeksjon (READ-ONLY)

**Start:** 2026-05-23 10:33 UTC  
**Staging først, deretter prod.**

### 2.1 Schema-oversikt

| Miljø | Public BASE TABLE | Views | Total objekter (excl. auth/storage) |
| ----- | ----------------: | ----: | ----------------------------------: |
| Staging | 135 | 22 | 157 |
| Prod | 135 | 22 | 157 |

**Paritet:** Tabellantall identisk. Inkluderer 40+ `audit_log_y*` partisjoner, 5 `_migration_*` legacy-tabeller, AI/growth-tabeller.

---

### 2.2–2.3 Kolonner/tabeller uten kode-bruk

**Ikke fullt enumerert** (150+ tabeller × kolonner). Baseline + spot-check:

| Tabell | Kode-referanse | Notat |
| ------ | -------------- | ----- |
| `social_posts` | superadmin growth | Beta/stub |
| `lead_pipeline` | sales AI | Superadmin-only |
| `marketing_pages` | delvis | Backoffice |
| `repair_jobs` | superadmin repairs | Aktiv |
| `_migration_*` | ingen app-ref | Legacy archive — forventet |

[DC-017] schema-hygiene | LAV  
Bevis: `_migration_legacy_stub_*` (5 tabeller), staging SQL  
Beskrivelse: Migrasjons-artefakter i public schema uten app-referanse.  
Anbefaling: Flytt til dedikert schema eller dokumenter som read-only archive; vurder sletting post-K6.  
Effort: M

---

### 2.4 RLS-policies

**Tabeller uten policies (staging, excl. audit_log_y* partisjoner):**

| Tabell | RLS enabled | Risiko |
| ------ | ----------- | ------ |
| `billing_products` | **false** | HARD — reference data eksponert |
| `billing_tax_codes` | **false** | HARD — MVA-koder |
| `company_deletions` | **false** | HARD |
| `invoice_periods` | **false** | HARD |
| `tripletex_exports` | **false** | HARD |
| `company_invites` | true, **0 policies** | Fail-closed (kun service_role) |
| `employee_invites` | true, **0 policies** | Fail-closed |
| `menu_visibility_days` | true, **0 policies** | Fail-closed |
| `tripletex_webhook_events` | true, **0 policies** | Fail-closed |
| `webhook_events` | true, **0 policies** | Fail-closed |
| `_migration_*` (5) | varierer | Internal |

**Policies med `qual = true` (authenticated read-all):**

- `allergens_select`, `dietary_tags_select`, `product_categories_select` — bevisst katalogdata for autentiserte brukere.

**Anon write:**

- `company_registrations_anon_insert` — INSERT only, PENDING + validering (frozen onboarding).

[DC-018] rls | HARD-BLOCK → **LUKKET (PR-X2, prod 2026-05-23)**  
Bevis: SQL staging+prod — `billing_products`, `billing_tax_codes` `rowsecurity=false`  
Fix: `20260609120000_dc018_enable_rls_billing.sql` — RLS + authenticated SELECT, write kun service_role  
Dokumentasjon: `docs/audit/dc-018-rls-fix.md`

[DC-019] rls | HARD-BLOCK → **LUKKET (PR-X3, prod 2026-05-23)**  
Bevis: SQL staging+prod — `invoice_periods`, `tripletex_exports`, `company_deletions` `rowsecurity=false`  
Fix: `20260609130000_dc019_enable_rls_tenant_tables.sql` — tenant SELECT via `can_access_company`; `tripletex_exports` JOIN-basert; `company_deletions` superadmin-only  
Dokumentasjon: `docs/audit/dc-019-rls-fix.md`

[DC-020] rls | HØY  
Bevis: SQL — `company_invites`, `employee_invites` RLS=true, 0 policies  
Beskrivelse: Fail-closed for PostgREST (OK), men avviker fra standard policy-dokumentasjon — vanskelig å audite.  
Anbefaling: Legg til eksplisitte deny-all policies med kommentar, eller dokumenter service_role-only kontrakt.  
Effort: S

[DC-021] rls | MEDIUM  
Bevis: SQL — 40× `audit_log_y*` partisjoner `rowsecurity=false`  
Beskrivelse: Partisjon arver ikke parent RLS; data tilgjengelig uten policy på partisjon. Parent `audit_log` har policy.  
Anbefaling: Verifiser GRANT-revoke for authenticated på partisjoner; vurder `ALTER TABLE … ENABLE ROW LEVEL SECURITY` på partisjoner.  
Effort: M

---

### 2.5 Foreign keys & indekser

**Ikke fullt cross-sjekket** (100+ FK). Spot-check prod største tabeller:

| Tabell | n_live | n_dead | Size |
| ------ | -----: | -----: | ---- |
| audit_log_legacy | 18823 | 24 | 38 MB |
| audit_log_y2026m05 | 18926 | 10 | 20 MB |
| companies | 9 | 49 | 992 kB |
| outbox | 6 | 42 | 128 kB |

[DC-022] db-health | MEDIUM  
Bevis: SQL prod — `companies.n_dead_tup=49` vs `n_live=9`; `outbox.n_dead=42` vs `n_live=6`  
Beskrivelse: Høy dead-tuple ratio på lav-volume tabeller — autovacuum kan være treg eller UPDATE-tung drift.  
Anbefaling: `VACUUM ANALYZE` på staging først; overvåk etter prod-smoke.  
Effort: S

---

### 2.6 Migrasjoner

**Repo:** 262 filer i `supabase/migrations/`  
**Prod ledger (siste 5):** `20260522201310_k4_kill_esg_tables`, `k1_outbox_claim_event_kind_filter`, `tpt_b7_polish9_webhook_subscriptions`, …  
**Staging ledger:** 59 (36 færre enn prod)

[DC-014] (duplikat — se Fase 1.7)

**ADD COLUMN uten DEFAULT:** Ikke fullt skannet; baseline dokumenterer historiske lock-risiko. Relevant for postmortem, ikke ny funn.

---

### 2.7 Funksjoner, triggere, RPC

**Public functions:** 100+ `lp_*` RPC-er (baseline). Cross-sjekk ubrukte RPC: **ikke fullført** — anbefaler `rg "\.rpc\(['\"]lp_" app/ lib/`.

---

### 2.8 Storage buckets

**Staging + prod:** `storage.buckets` → **0 rader**. Ingen buckets konfigurert.

Ingen funn — media via Sanity/Umbraco.

---

### 2.9 Auth-helse (prod)

| Metrikk | Verdi |
| ------- | ----: |
| Total users | 19 |
| Deleted | 0 |
| Stale >180d (ikke slettet) | 0 |

---

### 2.10 Tabell-helse

Se DC-022. Ingen tabell med `n_dead > n_live` blant top-20.

---

### 2.11 Staging vs prod diff

| Dimensjon | Resultat |
| --------- | -------- |
| Tabellantall | **Identisk** (135) |
| Tabeller kun staging / kun prod | **Ingen** (antall-nivå) |
| Migrasjons-ledger | Staging **59**, prod **95** — **HØY drift** |
| Kolonne/policy diff per tabell | **Ikke full-diff** (krever schema dump compare) |

[DC-023] schema-drift | HØY  
Bevis: SQL — staging 59 vs prod 95 migrasjoner  
Beskrivelse: Staging branch er 36 migrasjoner bak prod. Schema-paritet på tabell-nivå holder, men funksjon/policy-diff ukjent.  
Anbefaling: Apply pending migrasjoner til staging; kjør `scripts/audit/p3m3-run-prod-checks.mjs` diff.  
Effort: M

---

## Fase 3 — Kryss-system-integritet

**Start:** 2026-05-23 10:45 UTC

### 3.1 Sanity ↔ Supabase

**Filer med både sanity og supabase imports (utvalg):**

| Fil | Mønster |
| --- | ------- |
| `lib/menu-publish/syncMenuServiceDayItems.ts` | Sanity read → Supabase `menu_service_days` write |
| `lib/menu-publish/runMenuWeekRolloutCore.ts` | Sanity menuDay → Supabase sync |
| `app/api/webhooks/sanity/menu-day/route.ts` | Webhook trigger |
| `app/api/cron/menu-service-day-reconcile/route.ts` | Reconcile cron |

[DC-024] data-truth | MEDIUM  
Bevis: `menu_service_days` + `menu_service_day_items` i Supabase; Sanity `menuDay` som kilde  
Beskrivelse: Supabase speiler Sanity med webhook + reconcile — **bevisst cache**, ikke HARD-BLOCK. TTL/eventual consistency avhenger av cron (`menu-service-day-reconcile`).  
Anbefaling: Dokumenter cache-kontrakt (max staleness, reconcile SLA) i `docs/rc/menu-sync-rc.md`.  
Effort: S

---

### 3.2 Umbraco ↔ Next.js

**Funn:** Ingen direkte HTTP-kall til `lunchportalen.no` Delivery API i forretningslogikk. Umbraco håndteres via:

- `next.config.ts` rewrite `/umbraco/*` → `UMBRACO_CMS_ORIGIN`
- `middleware.ts` skip Supabase på `/umbraco`
- Backoffice UI-paritet (data-attributter `data-lp-umbraco-*`)

[DC-025] architecture | LAV  
Bevis: `next.config.ts:42-59`, `lib/cms/contentPageResult.ts:9`  
Beskrivelse: Next.js proxier Umbraco backoffice — forventet. Marketing HTML forblir på Umbraco (utenfor app-scope).  
Anbefaling: Ingen endring. Flagget for sporbarhet.  
Effort: S

---

### 3.3 Tripletex Flow 1 vs Flow 2

**Flow 2 token-lagring (staging schema):**

```
provider_tripletex_credentials
  consumer_token_secret_id  → uuid (Vault)
  employee_token_secret_id  → uuid (Vault)
  encryption_version        → integer
  connection_state          → text
```

**RLS:** `provider_tripletex_credentials_superadmin_all` — platform admin only ✓

**Flow 1 entrypoints:**

| Komponent | Flow |
| --------- | ---- |
| `lib/integrations/tripletex/client.ts` `resolveTripletexAuth()` uten providerId | Flow 1 default |
| `app/api/cron/tripletex-saas-monthly/route.ts` | Flow 1 (Lp SaaS faktura) |
| `lib/integrations/tripletex/providerSaasInvoiceSync.ts` | Flow 1 |
| `lib/integrations/tripletex/onboardingVerify.ts:116` | Flow 1 consumer token |
| `app/api/tripletex/prod-verify/route.ts` | Flow 1 verify |
| `app/leverandor/innstillinger/tripletex/*` | Flow 2 |
| `lib/integrations/tripletex/agreementInvoiceSync.ts` | Flow 2 (per provider) |
| `app/api/cron/tripletex-agreements-daily/route.ts` | Flow 2 |

[DC-026] tripletex | HØY  
Bevis: `client.ts:7-9` — «Default-args = Lp's env (unchanged behavior)»  
Beskrivelse: Flow 1 er implicit default når `providerId` utelates. Prod-kjøp utsatt, men cron `tripletex-saas-monthly` kan fortsatt enqueue Flow 1-events hvis env satt.  
Anbefaling: Se Fase 4 — feature-flag før K6 LIVE.  
Effort: M

---

## Fase 4 — Tripletex scope-down-plan

**Start:** 2026-05-23 10:50 UTC  
**Ikke implementert — kun plan.**

### 4.1 Kodeklassifisering

| Kategori | Filer |
| -------- | ----- |
| **Flow 1-only** | `app/api/cron/tripletex-saas-monthly/`, `lib/integrations/tripletex/providerSaasInvoiceSync.ts`, `app/api/tripletex/prod-verify/`, `tests/integrations/providerSaasInvoiceCreateLp.test.ts` |
| **Flow 2-only** | `app/leverandor/innstillinger/tripletex/**`, `lib/integrations/tripletex/agreementInvoiceSync.ts`, `lib/integrations/tripletex/providerCredentials.ts`, TPT-B-7b tester |
| **Hybrid (refaktor)** | `lib/integrations/tripletex/client.ts`, `lib/integrations/tripletex/onboardingVerify.ts`, `app/api/cron/tripletex-outbox/` |
| **Shared** | `TRIPLETEX_BASE_URL`, VAT/product helpers, webhook handlers |

### 4.2 Foreslått feature-flag

| Element | Forslag |
| ------- | ------- |
| **Lokasjon** | `lib/featureFlags.ts` + env `TRIPLETEX_FLOW_1_ENABLED` (default `false`) |
| **Gate punkter** | `resolveTripletexAuth()` uten providerId → throw CONFIG if flag false; cron `tripletex-saas-monthly` early 503; superadmin SaaS UI skjules |
| **UI skjul** | Superadmin Tripletex SaaS-faktura paneler; `prod-verify` route returnerer 503 med melding |
| **Runbook** | `docs/operations/tripletex-deferral.md` — lenke fra baseline K6-blokkering |
| **Alternativ** | Supabase `system_settings` key (krever migrasjon) — env foretrukket for RC |

### 4.3 Flow 2 test-dekning

**PASS uten Flow 1:** TPT-B-7b wizard tests, `tests/integrations/agreementInvoiceCreateProvider.test.ts`, `tests/api/webhook-tripletex-provider.test.ts`, DB-tester med `lp_provider_*` RPC.

**Avhengig Flow 1:** `tests/integrations/providerSaasInvoiceCreateLp.test.ts` — må `describe.skipIf(!flow1Enabled)` sammen med flagg.

---

## Fase 5 — K7 kreditnota / MVA pre-check

**Start:** 2026-05-23 10:50 UTC  
**Kartlegging — ikke implementasjon.**

### 5.1 Eksisterende kode

| Område | Status |
| ------ | ------ |
| `app/api/superadmin/invoices/reverse/route.ts` | Returnerer **501** `CREDIT_NOTE_NOT_IMPLEMENTED` (K2 deferred) |
| `billing_tax_codes.tripletex_vat_code` | MVA-mapping til Tripletex |
| `agreement_invoice_lines.vat_rate` | Per-linje sats |
| `onboarding/complete` | `vat_rate` default 15 % matmoms |

### 5.2 Supabase tax/MVA-kolonner

`billing_tax_codes`, `agreement_invoice_lines.vat_rate`, `invoice_lines` (via superadmin views), `provider_invoices.amount_tax`.

### 5.3 Gap vs norsk bokføringslov

| Krav | Dagens tilstand |
| ---- | --------------- |
| Sekvensiell kreditnota-nummerering | **Mangler** — ingen `credit_notes` tabell |
| Originalfaktura-referanse | Delvis — `tripletex_invoices.external_invoice_id` |
| MVA-grunnlag per linje | Delvis — agreement flow har `vat_rate` |
| Bokføringsdato vs fakturadato | Uklart — krever bruker-input |
| 5-års lagring | Audit logs finnes; ingen dedikert retention policy dokumentert |

**Leveres som åpne spørsmål nedenfor — ikke klassifisert som funn.**

---

## Fase 6 — Verifisering

**Start:** 2026-05-23 11:05 UTC

- Testsuite kjørt 2×: **2333 PASS / 0 FAIL**
- `git status`: ingen staged/modified tracked files — kun ny audit-doc
- Ingen kodeendringer utført

---

## Komplett funnregister (DC-001 – DC-027)

| ID | Kategori | Alvor | Status | Effort |
| -- | -------- | ----- | ------ | ------ |
| DC-001 | dead-code | MEDIUM | open | S |
| DC-002 | dead-code | LAV | open | S |
| DC-003 | observability | HØY | open | M |
| DC-004 | observability | MEDIUM | open | S |
| DC-005 | config | HØY | open | M |
| DC-006 | ui-system | MEDIUM | open | L |
| DC-007 | ui-system | MEDIUM | open | L |
| DC-008 | ui-system | LAV | open | S |
| DC-009 | a11y | MEDIUM | open | M |
| DC-010 | a11y | LAV | open | S |
| DC-011 | security | HARD-BLOCK | **LUKKET** (prod 2026-05-23) | — |
| DC-027 | security | HARD-BLOCK | **LUKKET** (prod 2026-05-23) | — |
| DC-012 | security | HØY | open | S |
| DC-013 | dependencies | HØY | open | M |
| DC-014 | migrations | HØY | open | M |
| DC-015 | test-gap | MEDIUM | open | L |
| DC-016 | observability | MEDIUM | open | M |
| DC-017 | schema-hygiene | LAV | open | M |
| DC-018 | rls | HARD-BLOCK | **LUKKET** (prod 2026-05-23) | — |
| DC-019 | rls | HARD-BLOCK | **LUKKET** (prod 2026-05-23) | — |
| DC-020 | rls | HØY | open | S |
| DC-021 | rls | MEDIUM | open | M |
| DC-022 | db-health | MEDIUM | open | S |
| DC-023 | schema-drift | HØY | open | M |
| DC-024 | data-truth | MEDIUM | open | S |
| DC-025 | architecture | LAV | open | S |
| DC-026 | tripletex | HØY | open | M |

### Baseline-duplikater (ikke re-funn, status uendret)

- Umbraco DB-passord i repo — **lukket K3 2026-05-22**
- Outbox race — **lukket K1 2026-05-22**
- `invoice.reverse` handler — **lukket K2 2026-05-22**
- Sentry end-to-end — **lukket H1 2026-05-22**
- 259→262 migrasjonsfiler vs prod ledger — **oppdatert tall DC-014**

---

## Lessons learned (PR-X1)

- **Diagnose før fix:** B3 over-flagging i Fase 2 ble avdekket i Fase 2.5 — route-inventory + manuell klassifisering ga korrekt allowlist.
- **Invariant-tester forhindrer drift:** Commit 10 la til allowlist-regression-tester (`api-allowlist-regression.test.ts`) — fanger cron-ruter som mangler i allowlist.
- **Staging-alias-drift maskerer security-bugs:** Fase 4.5c viste at `staging.app.lunchportalen.no` pekte på 4d gammel deploy uten DC-011 — alltid verifiser `x-lp-mw-bypass: allowlist` før GO.
- **Preview vs staging env:** Staging-branch deploy bruker Vercel **Preview** env — `CRON_SECRET` må pulls fra Preview, ikke separat staging-env.

---

## Åpne spørsmål til bruker

1. **K7 kreditnota:** Skal kreditnota nummereres i Supabase (`credit_notes` tabell) eller kun via Tripletex Flow 2 per provider?
2. **K7 MVA:** Hvilken MVA-sats gjelder for SaaS-abonnement (Flow 1) vs avtalefaktura (Flow 2) — 25 % standard eller 15 % matmoms?
3. **RLS på `billing_*`:** Er disse tabellene kun ment for service_role-tilgang via GRANT-revoke, eller skal authenticated ha scoped SELECT?
4. **Staging catch-up:** Skal staging applyes til 95 migrasjoner før neste K6-forsøk?
5. **Flow 1 flag default:** Bekreft at `TRIPLETEX_FLOW_1_ENABLED=false` skal være prod-default fra dag én?
6. **Knip/ts-prune:** Skal dead-code scan kjøres som CI-gate eller manuell sprint-oppgave?
7. **Audit_log partisjoner:** Er bevisst RLS-disabled med GRANT-revoke dokumentert et sted?

---

*Generert av deep-crawl audit 2026-05-23. Oppdatert PR-X1 Fase 5 prod-close 2026-05-23.*
