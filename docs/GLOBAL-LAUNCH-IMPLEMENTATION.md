# GLOBAL LAUNCH — P0 IMPLEMENTERING

Status per 2026-07-11. Mål: produksjonsklar global SaaS 18. juli 2026 (`app.lunchportalen.no`).

**Avgrensning (absolutt):** Umbraco og `lunchportalen.no` er ikke endret eller testet i dette implementeringsoppdraget. Ingen Umbraco-filer, -workflows eller Azure-ressurser er berørt. Ingen production-ressurs (Vercel, hosted Supabase, Stripe Dashboard) er endret.

---

## FASE A — Auth, roller og tenant

### A1: `custom_access_token_hook`

**Funn (P0):** Hooken (migrasjon `20260708120000`) filtrerte kun på `memberships.status = 'active'`. Et aktivt medlemskap i en **arkivert organisasjon** (companies.status `CLOSED`/`TERMINATED`, providers.status `CLOSED`) kunne fortsatt minte `active_org_id`/`active_role`-claims.

**Løsning:** Ny additiv migrasjon `supabase/migrations/20260811120000_auth_hook_archived_org_guard.sql`:
- Ny helper `public.lp_org_is_archived(uuid)` — sjekker spine (`organizations.status`) OG live legacy-status (`companies`/`providers`), fail-closed.
- `custom_access_token_hook` erstattet (CREATE OR REPLACE, identisk semantikk + arkiv-guard i alle fire membership-spørringer).
- Historiske migrasjoner urørt.

**Tester:** `tests/db/customAccessTokenHook.test.ts` (11 tester, lokal Supabase, runtime-skip uten DB):
null medlemskap · ett · flere (deterministisk prioritet) · suspendert · arkivert org · platform admin · provider admin · company admin · employee/orderer · ugyldig preferred membership (fallback) · stale inbound claims ikke stolt på · fail-safe ved ugyldig user_id.

**Status:** LUKKET. Dashboard-aktivering av hooken i prod er operatørsteg (runbook).

### A2: Ende-til-ende rollematrise

Håndhevelse verifisert i tre lag: middleware (session-gate, allowlist fail-closed 401), route handlers (`scopeOr401` + `requireRoleOr403` + DB-profilsjekk), DB/RLS (147/147 tabeller RLS enabled, spine FORCE RLS). Negativ tenant-matrise finnes i `tests/rls/tenantIsolation.final.test.ts` (opt-in mot staging) + `tests/server/setCompanyStatusAction.test.ts` (rollenegativ).

### A3: SEC-004 — `setCompanyStatus`

**Funn (bekreftet):** Server-action i `app/superadmin/firms/[companyId]/actions.ts` hadde ingen eksplisitt superadmin-gate (stolte på RLS), ingen overgangsmatrise, ingen audit, og konverterte ugyldig status stille til `PENDING` (brudd på fail-closed).

**Løsning:** Actionen er hardnet, ikke fjernet (brukes av `CompanyStatusControls` på firmadetaljsiden):
- Eksplisitt gate: session + `isSuperadminProfile` (profiles.role) → 401/403
- Streng validering: ukjent status → 400 `VALIDATION` (ingen fallback)
- Overgangsmatrise: PENDING→{ACTIVE,PAUSED,CLOSED}, ACTIVE→{PAUSED,CLOSED}, PAUSED→{ACTIVE,CLOSED}, CLOSED→{ACTIVE}; ugyldig → 409 `INVALID_TRANSITION`
- Idempotent no-op ved samme status
- Skriver via kanonisk `applyCompanyLifecycleStatus` (samme path som `POST /api/superadmin/companies/set-status`)
- Audit via `logOpsEventBestEffort`: actor, tenant, før/etter, tidspunkt, via-kanal

**Tester:** `tests/server/setCompanyStatusAction.test.ts` (9 tester, inkl. negative for company_admin og employee, og «company admin kan ikke aktivere PENDING-firma»).

**Status:** LUKKET.

---

## FASE B — Billingdatabase

### B1: Migrasjonsrekken 20260729–20260809

12 migrasjoner + `20260810120000` (cherry-picket til prod). Blokken skaper 13 tabeller:
`markets`, `organization_billing_profiles`, `payment_methods`, `order_line_commercial_snapshots`, `commission_rules`, `commission_ledger`, `commission_periods`, `provider_commission_invoices`, `invoice_deliveries`, `billing_audit_log`, `billing_readiness_events`, `billing_payment_attempts`, `stripe_billing_webhook_events` — alle med RLS + policies. 13 SECURITY DEFINER-RPC-er (`lp_billing_*`) med pinned `search_path`. Append-only-triggere på `commission_ledger`, `billing_audit_log`, `order_line_commercial_snapshots`. Idempotente (IF NOT EXISTS / CREATE OR REPLACE / policy-guards).

**Deploy-kritisk funn:** Prod har allerede `20260810120000` → billingblokken sorterer FØR siste anvendte migrasjon. Supabase CLI feiler lukket (`LegacyMigrationMissingRemoteError`). **Produksjonsrelease MÅ bruke `supabase db push --include-all`.**

Ingen guard-migrasjon nødvendig: blokken passerte ut-av-rekkefølge-kjøring rent (verifisert, se B3).

### B2: Ren database

`supabase db reset` → alle 62 migrasjoner (inkl. ny `20260811120000`) kjører uten feil. Ingen dupliserte objekter. Verifisert 2026-07-11.

Typegen: lokal `supabase gen types`-container feiler (infra); `lib/types/database.ts` dekker billingtabellene via eksisterende `LoosePublicTable`-modell (kjent debt NEXT-001 — ikke launch-blokker, typecheck grønn).

### B3: Production-likt utgangspunkt

`scripts/ci/billing-prod-sim-verify.mjs` (NY, kun lokal DB):
1. reset til `20260728120000` (pre-billing) — verifisert 0 billingtabeller
2. cherry-pick `20260810120000` + registrer versjon (eksakt prod-paritet)
3. `supabase migration up --include-all` (billingblokken)
4. verifiser: 13 tabeller m/RLS+policies, 13 SECDEF-RPC-er m/search_path, 0 anon-grants, ingen duplikater
5. full reset tilbake

**Resultat: VERIFY PASS (42/42 sjekker).** Varig testdekning: `tests/db/billingSchemaIntegrity.test.ts` (6 tester).

**Rollback:** Billingblokken er additiv — rollback = ikke aktiver billing-flows (kill switch) + `DROP`-liste dokumentert i runbook. Ingen produksjonsdata slettes.

---

## FASE C — Stripe og webhooks

### C1: SEC-001

**Funn (bekreftet):** `/api/webhooks/stripe-billing-payments` og `/api/webhooks/stripe-provider-setup` manglet i middleware-allowlisten → 401 før signaturvalidering; betalingsevents gikk tapt (Stripe-retry ville også feile).

**Løsning:** To oppføringer i `lib/server/auth/apiAllowlist.ts` (86→88). Signaturvalidering skjer fortsatt i handler (`stripe.webhooks.constructEvent` på rå body); service role brukes kun etter validering.

### C2: Regresjonstest

`tests/security/stripe-webhook-chain.test.ts` (13 tester): middleware-allowlist → handler → signatur → idempotens. Dekker gyldig event, ugyldig/manglende signatur, feil Stripe-konto, ukjent eventtype, duplikat event, replay ×3, unmatched intent, DB-feil på idempotenslag (→ 500, Stripe retrier), manglende webhook-secret (fail-closed), payment_failed-mapping m/failure codes, HTTP-kontrakt (400/200 + rid).

### C3: Payment flows

Eksisterende suiter grønne (27 tester): `stripeProviderSetup` (setup intent, PM attach), `stripeProviderCharge` (off-session charge, idempotency key), `stripePaymentWebhook` (success/failure/recovery), `globalCommission` + `commission_correction_negative_ledger` (negativ ledgerkorreksjon/refund, append-only).

**Status:** LUKKET.

---

## FASE D — Cron

### D1: CRON-001

**Funn (bekreftet):** `lib/http/cronAuth.ts` returnerte OK på `x-vercel-cron: 1` alene, FØR secret-sjekk. Alle 30+ cron-ruter (inkl. fakturagenerering) kunne startes med en fritt valgt header dersom edge/omvendt proxy ikke strippet den, og hele sikkerheten hvilte på Vercel-plattformantakelse.

**Løsning:** `requireCronAuth` er fail-closed:
- Secret (CRON_SECRET / SYSTEM_MOTOR_SECRET) ALLTID påkrevd — mangler → `cron_secret_missing` (ingen åpen fallback, i alle miljøer)
- `x-vercel-cron` er kun observability-tag når secret OGSÅ matcher
- Timing-safe sammenligning (SHA-256 + `timingSafeEqual`)
- `CRON_SECRET` lagt til `REQUIRED_SYSTEM_RUNTIME_KEYS` → health = DEGRADED i prod hvis mangler

**Operativ konsekvens:** Vercel Cron fungerer fordi Vercel sender `Authorization: Bearer <CRON_SECRET>` når env-var er satt. **Pre-deploy-krav: CRON_SECRET satt i prod** (runbook).

### D2: Alle cron-ruter

- Statisk skann (`tests/security/cron-fail-closed.test.ts`): alle cron-ruter bruker delt gate; ingen egen `x-vercel-cron`-logikk.
- Økonomisk jobb `/api/cron/invoices/generate` verifisert: unik kjøringsnøkkel (`unique_ref = company:period`), idempotent upsert på `(company_id, period)`, `SKIPPED_SENT`-vern (aldri rewrite av sendt faktura), outbox-dedup på `event_key`, dryRun-modus, strukturert logging m/rid, FAILED-rader m/`last_error`.
- Stripe recovery: `lp_billing_apply_payment_recovery_policy` (SECDEF, testet).

**Status:** LUKKET.

---

## FASE E — Global språkmodell

**Kartlagt (read-only audit):** Reell kjede var cookie → `profiles.preferred_locale` → `nb`. Bedrifts- og markedssteg fantes ikke. Accept-Language brukes aldri (governance-testet) — browser kan ikke overstyre eksplisitt valg.

**Implementert (P0):**
- **E1 locale-kjede komplett:** `resolveAppLocale` utvidet til cookie → profil → **bedrift** (`companies.preferred_locale`, ny additiv migrasjon `20260812120000`) → **marked** (`billing_country` → `SUPPORTED_MARKET_LOCALES.fallbackAppLocale`) → `nb`. Wiret i `i18n/request.ts` via `loadLocalePreferencesForRequest` (fail-safe). 12 nye tester i `tests/lib/i18n/resolveAppLocale.test.ts`.
- **E4 rå DB-status lekkasje lukket:** `mineLunsjOrderTitleNb` viste `Ordrestatus: <RAW_ENUM>` for ukjente statuser — nå mappes produksjons-/leveringsstatuser til norsk, ukjent → nøytral tekst (fail-closed).
- **E3 rå Sanity-nøkkel lekkasje lukket:** `displayLabelForMealTypeKey` returnerte rå key for ukjente mealTypes — nå humanisert label, aldri snake_case (`tests/lib/cms/mealTypeDisplayFallback.test.ts`).
- Menyoversettelser verifisert: publisert oversettelse brukes (approved + hash-match), manglende → original tekst (fail-closed), stale håndteres hash-basert (`menu_content_translations`, SMART-3 overlay).
- Statusverdier: DB beholder kanoniske enums; visningslag oversetter (provider kitchen/billing via i18n-nøkler — verifisert).

**Kjente avvik (dokumentert, ikke launch-blokker for NO):**
- Alle transaksjonelle e-poster er nb-only (invitasjon, godkjenning, reset, uke-åpning). Ingen rå oversettelsesnøkler, men ikke mottakerspråk-valg. → Markert FAIL for ikke-NO markeder i launch-matrisen; aktiveringskrav per marked.
- Employee-UI mangler `employee.*` message-bundle (kun provider-shell har full 9-språksdekning). → Aktiveringskrav per marked.

---

## FASE F — Marked, valuta, tid og MVA

**Kartlagt:** `markets`-tabellen (billingblokken) er autoritativ: 21 markeder seedet, kun **NO `is_active=true`** (bevisst NO-first, ADR-017). Ordrelinjer bruker minor units (cents); ny global commission-motor bruker bigint minor med half-away-avrunding (testet) men er ikke runtime-koblet. Cutoff er 08:00 Europe/Oslo i hele ordre-stien (RPC + trigger); `compute_cutoff_at` (per-lokasjons-TZ) finnes men brukes kun av MSDI.

**Beslutninger (fail-closed, dokumentert):**
- Ingen endring i cutoff-/valuta-runtime før markedsaktivering — NO-flyten er korrekt og frossen (Protected Golden Path). Multi-TZ cutoff og MVA per marked er **aktiveringskrav per nytt marked** (se GLOBAL-LAUNCH-MATRIX.md).
- Float-matte i legacy `invoiceEngine.ts` (`count * price_per_employee`, toFixed(4)) er kjent debt — avgrenset (NOK, to desimaler); go-forward er bigint-motoren. Ikke endret i RC-vinduet (regresjonsrisiko > gevinst).
- Lagring: `orders.date` er kalenderdato (dokumentert format), `menu_service_days.cutoff_at`/Sanity-tidspunkt er UTC `timestamptz` — konsistent.

---

## FASE G — Bestilling og avbestilling

**Golden path verifisert server-autoritativ (G3):** `/api/orders` → `lp_order_set`: tenant fra `profiles` via `auth.uid()` (aldri klient), pris fra avtale/menysnapshot (klient-prisfelt avvises for employee via `assertEmployeeOrderBodyHasNoPricingOverrides`), cutoff i tre lag (HTTP + RPC + trigger), idempotens via `Idempotency-Key` + `lp_idem_*`, avbestilling idempotent med rollup-rebuild outbox.

**P0 lukket — split-brain-ruter (Protected Golden Path Impact deklarert):**
- `POST /api/order/cancel` → **410 DEPRECATED**. Ruten muterte kun `day_choices` med service role (ordre-raden forble ACTIVE → avbestilt porsjon kunne bli produsert/fakturert). Ingen aktive konsumenter (Week/OrderActions bruker `/api/orders`; `lib/api/client.cancelOrder` hadde null importer).
- `POST /api/order/bulk-set` → **410 DEPRECATED**. Skrev `day_choices` direkte med service role utenom `lp_order_set`, og var allerede død i praksis (avhang av `companies.contract_week_tier`-kolonner som ikke finnes i skjemaet; eneste klient `NextWeekOrderClient` er ikke rendret).
- Regresjonstest: `tests/api/order-legacy-day-choice-routes-deprecated.test.ts` (410 + ingen service-role/day_choices-kode igjen). Rollback: revert av de to rutefilene.

**Avbestillingsøkonomi:** Provisjon posteres kun ved levering (`ORDER_COMPLETED`); avbestilling før levering gir ingen provisjonsrad (korrekt). Korreksjon etter levering: append-only `lp_billing_post_negative_commission_for_order` (idempotent, testet). Automatisk hook ved cancel-etter-levering finnes bevisst ikke (dokumentert operativ prosess).

---

## FASE H — Provider / company / employee

- Provider ser kun egne ordrer: `provider_id`-scoping i loader + RLS `orders_select_provider_scope`; provider-advance krever `lp_assert_provider_kitchen_access`.
- Company admin kan ikke endre provider-eid konfig: avtale-endringer kun via provider-ruter med `authorizeProviderCustomerAdmin` (companies.provider_id-match); ingen `provider_id`-mutasjon i admin-API.
- Employee kan ikke manipulere tenant/pris: statisk gate-test forbyr klient-tenant i scoped routes; RPC bruker `auth.uid()`.
- Negativ matrise: `tests/tenant-isolation*.test.ts` (8 suiter) + `tests/rls/*` (opt-in staging) + `tests/server/setCompanyStatusAction.test.ts` (company_admin/employee 403) — alle grønne.
- SR-001 (46 middleware-only-ruter med service role) er dokumentert debt — to ordre-kritiske av dem er nå deprecated (over); resten krever systematisk gate-innføring post-launch.

---

## FASE I — Kill switches

**Modellvalg:** Utvidet eksisterende `system_settings.killswitch` (superadmin-eid, server-side håndhevet, allerede wiret for orders/cancellations/emails/kitchen_feed/ai/global) — ikke noe nytt flaggsystem.

**Nye nøkler (default false = åpent):** `stripe_webhooks`, `stripe_setup`, `stripe_charges`, `billing`, `commission_posting`, `invoice_generation`, `cron`, `sanity_webhook`, `production_generation`.

**Håndhevelse (ny `lib/system/opsKillSwitch.ts`):**
- Stripe-webhookene (begge): 503 + `Retry-After` → Stripe redeliverer etter reaktivering
- Sanity menu-day webhook: 503 → Sanity retryer
- Fakturagenerering-cron: `cron` / `invoice_generation` / `billing`
- Marked: `markets.is_active` (DB) + company/agreement-status (eksisterende)
- Global halt (`global`) blokkerer alt

Tester: `tests/system/opsKillSwitch.test.ts` (8 tester: default åpent, eksplisitt true blokkerer, global halt, 503-kontrakt, rute-wiring). Blokkeringer logges (`OPS_KILL_SWITCH_BLOCKED`).

---

## FASE J — Observability

- Strukturert logging verifisert i kritiske flyter: rid i alle API-svar (`x-rid` + body), `[cron.*]`-logger med rid/period/outcome, webhook-feilkoder (`INVALID_SIGNATURE`, `WEBHOOK_IDEMPOTENCY_WRITE_FAILED`), 5xx → ops-incident-logg automatisk (`lib/http/respond.ts`), kill switch-blokkeringer logges.
- Ny statisk guard: `tests/security/no-secret-logging.test.ts` — ingen log-kall i `app/api`/`lib` kan referere Authorization-header, service-role key, Stripe-secret, access token eller CRON_SECRET.
- Audit: company-status (ops_events m/actor+før/etter), billing (`billing_audit_log`, append-only), webhook-events (`stripe_billing_webhook_events`).

---

## FASE K — Tester (endelige tall, 2026-07-11)

| Gate | Resultat |
|------|----------|
| `npm run typecheck` | ✅ PASS (exit 0) |
| `npm run lint` | ✅ PASS (exit 0, kun kjente design-token-advarsler) |
| Full vitest (unit/integration/API/component) | ✅ **5342 bestått · 0 feilet · 178 hoppet over** (753 filer; skips er forhåndseksisterende env-gatede staging-suiter) |
| `npm run test:golden-path` | ✅ 103/103 |
| `npm run test:tenant` | ✅ PASS |
| DB-integrasjon lokal Supabase (auth hook 11 + billing schema 6) | ✅ 17/17, 0 skips |
| Billing prod-simulering (`scripts/ci/billing-prod-sim-verify.mjs`) | ✅ VERIFY PASS (42 sjekker) |
| Ren DB-rebuild (`supabase db reset`, 63 migrasjoner) | ✅ PASS |
| Playwright kritiske flyter (auth, roller, redirect-sikkerhet, core flows, mobile invariants S1.1, shells) | ✅ **52 bestått · 0 feilet · 52 hoppet over** — de hoppede er autentiserte varianter som krever `E2E_*`-testbrukere (ikke konfigurert lokalt; kjøres i staging-vindu per runbook) |
| `npm run build:enterprise` | ✅ PASS (exit 0 — alle plattform-guards + protected-path-guard + full Next-build) |

RLS-suiten (`tests/rls/**`) er opt-in mot staging (`RUN_SUPABASE_INTEGRATION_TESTS=1` + staging-ref-guard som nekter prod) — kjøres i CI/staging-vindu; nye DB-tester (auth hook + billing) kjører mot lokal Supabase uten skips.

**Ingen skjulte skips for P0-flyter:** de 178 vitest-skippene og 52 E2E-skippene er miljøbetingede (staging-DB / E2E-brukere) og eksplisitt rapportert.

---

## Produksjonssteg (sammendrag — full versjon i GLOBAL-LAUNCH-RUNBOOK.md)

1. Backup + release-SHA + secrets-validering (CRON_SECRET, SYSTEM_MOTOR_SECRET, STRIPE_*_WEBHOOK_SECRET)
2. `supabase db push --include-all` (billingblokk + `20260811120000`)
3. Verifiser schema/RLS (kjør verifiserings-SQL fra runbook)
4. Aktiver auth hook i Supabase Dashboard (operatørsteg) + verifiser JWT-claims
5. Deploy app → smoke → aktiver webhooks/Stripe/billing/cron → overvåk

## Rollback (sammendrag)

- App: Vercel instant rollback til forrige deployment
- Billing: kill switch (ikke aktiver flows); DB-objekter er additive og kan stå
- Auth hook: deaktiver i Dashboard (claims forsvinner ved neste token-refresh; RLS er ikke wired til claims ennå — Fase 3-shadow)
- Cron/webhooks: deaktiver schedules / endpoint i hhv. Vercel og Stripe

## GLOBAL RELEASE GATE (2026-07-11, andre iterasjon)

Alle resterende global-launch-blokkere lukket:

1. **Autentiserte E2E i staging:** Playwright-runneren lastet aldri `.env.local` → alle autentiserte scenarier skippet stille. Fikset (`playwright.config.ts` dotenv + E2E_TEST_USER-fallback). Staging-brukere verifisert/reparert via nye staging-guardede skript (`scripts/e2e/verify-e2e-users.mjs`, `scripts/e2e/seed-e2e-role-users.mjs` — company_admin opprettet på A6-fixture, superadmin-passord synket). Resultat mot production-build + staging: **98 bestått · 6 feilet · 0 skippet** (104 scenarier). De 6 feilene har én felles rotårsak: `/backoffice/content`-editoren viser «Siden finnes ikke» for valgt side i staging (CMS-workspace/dual-runtime, kjent NEXT-005/ARCH-002-område; pre-eksisterende — synliggjort først nå som autentisert E2E kjører). **Ingen P0-flyt feilet:** login, rollelanding, redirect-sikkerhet, week/admin/superadmin-flater, mobile invariants — alle grønne. Registrert som P1-funn med repro.
2. **21/21 markedsrader komplette:** migrasjon `20260813120000` — `vat_rate_food`, `cutoff_local_time`, `invoice_language`, `stripe_status` + `is_active=true` for alle 21. Bevis: `tests/db/marketCutoffContext.test.ts` (matrisetest validerer alle rader).
3. **Oslo-lås fjernet:** migrasjon `20260814120000` — `lp_company_cutoff_context` (company-tz → market-tz → Oslo, fail-closed) wiret inn i BÅDE `lp_order_set` og `tg_orders_cutoff_0800`. NO-semantikk uendret (golden path 103/103). Protected Golden Path Impact deklarert; rollback = re-apply funksjonskropper fra 20260612/20260713.
4. **Lokaliserte e-poster:** `lib/email/i18n/emailCopy.ts` (9 språk × invitasjon + passordreset), mottakerspråk-kjede profil → bedrift → marked → nb (`lib/email/recipientLocale.ts`), wiret i invitasjons- og reset-sendere. 24 tester (`tests/lib/email/localizedEmailTemplates.test.ts`).
5. **Økonomi alle valutaer:** bigint-motor verifisert for 10 valutaer inkl. negative korreksjoner og half-away-avrunding; **NOK-float-flyten isolert til NO-markedet** (`loadNoMarketCompanyIds`-guard i fakturagenerering — ikke-NO ekskluderes fail-closed). `tests/lib/billing/multiCurrencyCommission.test.ts`.
6. **Production preflight (ikke-muterende):** `scripts/ci/production-migration-preflight.mjs` — tvinger read-only session, printer eksakt apply-plan, detekterer out-of-order (→ `--include-all`-krav), verifiserer pre-state-invarianter. Verifisert mot eksakt prod-lik lokal state (16 pending korrekt identifisert) OG opp-til-dato state.
7. **Matrix oppdatert:** 21/21 PASS med navngitt bevis per kolonne (se GLOBAL-LAUNCH-MATRIX.md).
8. **Runbook oppdatert:** eksakte operatørsteg for auth hook (Dashboard-klikk), CRON_SECRET (Vercel env + verifikasjon) og Stripe webhooks (endpoints, events, signing secrets, test/duplikat-verifikasjon).

**Nytt P1-funn (ikke launch-blokker):** Backoffice content-editor viser not-found for valgt side mot staging-data (tree renderer, editor-pane 404). Repro: logg inn som superadmin → `/backoffice/content`. Berører kun CMS-redigering (superadmin-intern), ikke bestillings-/produksjons-/billingflyt.

## FINAL PRODUCTION RELEASE GATE (2026-07-11, tredje iterasjon)

1. **De 6 backoffice-E2E-feilene LUKKET.** To rotårsaker: (a) staging manglet `preview`-environment-variant for `home`-siden → editorens fail-closed «Siden finnes ikke» (fikset med idempotent staging-fixture `scripts/e2e/seed-e2e-content-fixture.mjs` — editoren fungerte korrekt, data manglet); (b) testselektorene forventet en engelsk «content»-heading som ikke finnes i gjeldende markup — editorens reelle heading er «Hovedinnhold» (`ContentDetailDocumentEditor.tsx:440`). Selektorer oppdatert til faktisk markup. **Full kritisk suite: 104/104 bestått, 0 feilet, 0 skippet.** Ingen server-side deaktivering nødvendig.
2. **Production preflight-rapport:** `production-migration-preflight.mjs --report` genererer full markdown (alle 65 migrasjoner m/APPLIED/PENDING-status + 13 billingtabeller + 13 RPC-er). Generert fra eksakt prod-lik state: `docs/PRODUCTION-PREFLIGHT-REPORT.md` (16 pending, out-of-order → `--include-all`).
3. **Post-migration-verifikasjon:** ny `scripts/ci/post-migration-verify.mjs` (read-only): 65/65 migrasjoner, RLS+policies på alle billingtabeller, SECDEF+pinned search_path på alle RPC-er, null anon-grants, auth hook m/arkiv-guard, cutoff-wiring, 21/21 markeder, SECDEF-hygiene. Verifisert PASS mot simulert post-push state (prod-lik → `--include-all` → verify).
4. **Production-smoke:** ny `scripts/smoke/global-launch-smoke.mjs` (ikke-muterende, printer aldri secrets): auth hook-claims via ekte login + lokal JWT-dekoding, cron fail-closed (u/creds, kun x-vercel-cron, m/Bearer+dryRun), begge Stripe-webhookene (middleware-pass + usignert/forfalsket → 400, aldri 2xx). Staging-kjøring bekreftet: cron-gate PASS; webhook-secrets og hook-aktivering korrekt flagget som gjenstående prod-operatørsteg.
5–6. **Matrisen korrigert** med tre PASS-nivåer (CODE PASS / STAGING PASS / PRODUCTION VERIFIED): NO = STAGING PASS, 20 markeder = CODE PASS, **0 = PRODUCTION VERIFIED** — nivået krever prod-deploy, MVA kommersielt godkjent og ekte smoke-bestillingsflyt i markedet (kravliste i matrisen).
7. **Sperre-bekreftelse:** Umbraco-filer endret: 0 · Umbraco-workflows endret: 0 · Azure-ressurser endret: 0 · lunchportalen.no påvirket: nei · Production endret: nei.

## Go/No-Go (endelig, 2026-07-11)

**GO (CONDITIONAL) — 21/21 markeder PASS i launch-matrisen.** Alle P0-blokkere er lukket og testet lokalt + staging: SEC-001, SEC-004, CRON-001, auth hook-gap, split-brain ordre-ruter, billing-DB, markedskonfig (21/21), tidssone-cutoff ende-til-ende, lokaliserte e-poster, valuta-verifisering + NOK-isolasjon, autentisert E2E (0 skippet, 0 P0-feil).

Operatørsteg før 18. juli (runbook, i rekkefølge):

1. Preflight (read-only): `node scripts/ci/production-migration-preflight.mjs` mot prod → PREFLIGHT PASS
2. `supabase db push --include-all` (16 migrasjoner) + schema/RLS-verifisering (runbook steg 1–3)
3. `CRON_SECRET` satt i Vercel prod FØR app-deploy (cron er fail-closed)
4. Auth hook aktivert i Supabase Dashboard + JWT-claims verifisert (runbook steg 4, eksakte klikk)
5. Stripe webhook-endpoints + signing secrets registrert (runbook steg 7, eksakte events)
6. MVA-satser (seed-defaults) kommersielt/juridisk godkjent før første faktura i nytt marked

**Kjente P1-funn (ikke launch-blokkere):** backoffice content-editor not-found mot staging-data (kun superadmin-intern CMS-redigering); `nl` mangler UI-bundle (NL/nl-BE betjenes på engelsk, dokumentert i matrisen).

**Production-ressurser endret av dette oppdraget: ingen.** Umbraco-filer endret: 0 · Umbraco-workflows endret: 0 · Azure-ressurser endret: 0 · lunchportalen.no påvirket: nei.
