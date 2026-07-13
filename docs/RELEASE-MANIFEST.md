# RELEASE MANIFEST — global launch production candidate

Generert: 2026-07-11 (RELEASE IDENTITY GATE) · Forrige commit: `9b8655a9ee8436b9b10ecf7ce812b7f6f6574275` (branch `fix/go-operator-open-pr`)

Release-SHA settes av commiten «release: global launch production candidate» (dette dokumentet inngår i commiten; SHA refereres i cutover-rapporten).

**Beskyttede områder:** Umbraco-filer endret: 0 · Umbraco-workflows endret: 0 · Azure-ressurser endret: 0 · lunchportalen.no påvirket: nei. (Verifisert mot full diff: null treff på `umbraco|azure|workflows|cshtml|csproj|sln|appsettings|App_Plugins|ModelsBuilder`.)

## 1. Endrede filer (35 sporede)

| Fil | Endring |
|-----|---------|
| app/api/auth/forgot-password/route.ts | E5: mottakerspråk i passordreset |
| app/api/cron/invoices/generate/route.ts | Fase I kill switch + F: NOK-motor isolert til NO-markedet |
| app/api/order/bulk-set/route.ts | G P0: deprecated 410 (day_choices split-brain) |
| app/api/order/cancel/route.ts | G P0: deprecated 410 (day_choices split-brain) |
| app/api/webhooks/sanity/menu-day/route.ts | Fase I kill switch (sanity_webhook) |
| app/api/webhooks/stripe-billing-payments/route.ts | Fase I kill switch (stripe_webhooks/billing) |
| app/api/webhooks/stripe-provider-setup/route.ts | Fase I kill switch (stripe_webhooks/stripe_setup) |
| app/superadmin/firms/[companyId]/actions.ts | SEC-004: superadmin-gate, overgangsmatrise, audit |
| components/superadmin/CompanyStatusControls.tsx | SEC-004: strukturert svarhåndtering |
| e2e/core-flows.e2e.ts | E2E: backoffice-selektor → faktisk markup («Hovedinnhold») |
| e2e/mobile-invariants.e2e.ts | E2E: backoffice-selektorer → faktisk markup |
| i18n/request.ts | E1: full locale-kjede (bruker → bedrift → marked → nb) |
| lib/cms/mealTypeDisplayFallback.ts | E: rå Sanity-nøkkel lekker aldri |
| lib/email/passwordResetMail.ts | E5: 9-språks passordreset |
| lib/email/templates/employeeInvite.ts | E5: 9-språks invitasjon |
| lib/employee/mineLunsjEndringerNb.ts | E4: rå DB-enum lekker aldri |
| lib/env/system.ts | CRON-001: CRON_SECRET required runtime env |
| lib/http/cronAuth.ts | CRON-001: fail-closed, timing-safe |
| lib/i18n/profileLocale.ts | E1: profil+bedrift+marked-loader |
| lib/i18n/resolveAppLocale.ts | E1: full kjede + defaultAppLocaleForCountry |
| lib/invites/createEmployeeSingleInvite.ts | E5: mottakerspråk i invitasjon |
| lib/server/auth/apiAllowlist.ts | SEC-001: Stripe-webhooks allowlistet (86→88) |
| lib/system/routeRegistry.ts | G: cancel-rute korrekt annotert deprecated |
| lib/system/settings.ts | Fase I: 9 nye kill switch-nøkler |
| playwright.config.ts | E2E: dotenv-lasting + test-user-fallback |
| scripts/ci/commercial-hardcodes-allowlist.json | R1-sanksjonert linjeskift-oppdatering |
| tests/employee/mineLunsjEndringerNb.test.ts | oppdatert (fail-closed display) |
| tests/env/envValidation.test.ts | oppdatert (CRON_SECRET) |
| tests/lib/http/cronAuth.test.ts | oppdatert (fail-closed semantikk) |
| tests/lib/i18n/providerShellLocale.test.ts | oppdatert (ny loader) |
| tests/lib/i18n/resolveAppLocale.test.ts | oppdatert (full kjede, +12 tester) |
| tests/menu-service-day-webhook.test.ts | oppdatert (kill switch-mock) |
| tests/security/api-allowlist-regression.test.ts | oppdatert (88 + SEC-001-tester) |
| tests/security/no-implicit-bypass.test.ts | oppdatert (88) |
| tests/tenant-isolation-api-gate.test.ts | oppdatert (bulk-set deprecated) |

## 2. Nye filer (30)

**Migrasjoner (4):** `supabase/migrations/20260811120000_auth_hook_archived_org_guard.sql` · `20260812120000_company_preferred_locale.sql` · `20260813120000_markets_global_launch_readiness.sql` · `20260814120000_market_timezone_cutoff.sql`

**Lib (3):** `lib/email/i18n/emailCopy.ts` · `lib/email/recipientLocale.ts` · `lib/system/opsKillSwitch.ts`

**Skript (7):** `scripts/ci/billing-prod-sim-verify.mjs` · `scripts/ci/post-migration-verify.mjs` · `scripts/ci/production-migration-preflight.mjs` · `scripts/e2e/seed-e2e-content-fixture.mjs` · `scripts/e2e/seed-e2e-role-users.mjs` · `scripts/e2e/verify-e2e-users.mjs` · `scripts/smoke/global-launch-smoke.mjs`

**Tester (12):** `tests/api/order-legacy-day-choice-routes-deprecated.test.ts` · `tests/db/billingSchemaIntegrity.test.ts` · `tests/db/customAccessTokenHook.test.ts` · `tests/db/marketCutoffContext.test.ts` · `tests/lib/billing/multiCurrencyCommission.test.ts` · `tests/lib/cms/mealTypeDisplayFallback.test.ts` · `tests/lib/email/localizedEmailTemplates.test.ts` · `tests/security/cron-fail-closed.test.ts` · `tests/security/no-secret-logging.test.ts` · `tests/security/stripe-webhook-chain.test.ts` · `tests/server/setCompanyStatusAction.test.ts` · `tests/system/opsKillSwitch.test.ts`

**Docs (5):** `docs/GLOBAL-LAUNCH-IMPLEMENTATION.md` · `docs/GLOBAL-LAUNCH-MATRIX.md` · `docs/GLOBAL-LAUNCH-RUNBOOK.md` · `docs/PRODUCTION-PREFLIGHT-REPORT.md` · `docs/RELEASE-MANIFEST.md` (dette dokumentet)

## 3. Eksplisitt EKSKLUDERT fra release-commiten (pre-eksisterende, urelatert)

`.env.preview.verify` · `.pr-body-*.md` (5) · `docs/ARCHITECTURE.md` · `docs/OPEN-QUESTIONS.md` · `docs/RLS-AND-SECURITY-AUDIT.md` · `docs/TECH-DEBT.md` (revisjonsinput, eies separat) · `pnpm-lock.yaml` · `pnpm-workspace.yaml` · `scripts/temp-*.mjs` (26 pre-eksisterende probe-skript) · `temp/**` (arbeidsartefakter). Disse forblir untracked og inngår IKKE i release-identiteten.

## 4. Pending migrasjoner mot production (16) — SHA256

```text
1bfa220c43cdb7db4ded0b2564c61cd0d73bc4cb2ab855236714d540af3a9abe  20260729120000_global_billing_engine_foundation.sql
f802765d59e04e37b90b41fe8db2469218fda627b4f0c09175ffc0acf03eeaaa  20260730120000_order_billing_snapshot_ledger_wiring.sql
ec89cab18b75a3ce0099cc1e03fa0e552b2e6a477766789e0a05900e62e38d3b  20260731120000_billing_readiness_observability.sql
973c60f0619edb9b923e3ba015320330dd05b8c58f87be75c6e58160601c9077  20260801120000_commission_correction_negative_ledger.sql
5123c17f65f9192130f216baaca90d6f156fa1c4a396870271517042a14c72c4  20260802120000_payment_invoice_readiness_policy.sql
fbe35aa32bb4f1a78ffc45fd5eb9c94cc3113c29fe15837269224cbfb32dba8c  20260803120000_stripe_setup_intent_onboarding.sql
ac75b5df913b62909018385ad71861b4bc72417612ce3553c765f8947847692c  20260804120000_invoice_close_dry_run.sql
25103989e442f2f2b0c2311e42ebe249e6c2fadc383397581d4bd056eb7c4df1  20260805120000_final_commission_invoice_creation.sql
59ad41542d28c513abf4d69281d061e7d76c4d8b324230bf6553e1aac2d13046  20260806120000_stripe_charge_dry_run.sql
fc8c8588415596ad0e8f0cfd53219ef0e6bb67bf806eab98b3a8d6acb0934245  20260807120000_stripe_off_session_charge_attempts.sql
850b736d770e236aa136bea32b965fd02aab601914b1d14a9ea1f8709dcc982d  20260808120000_stripe_payment_webhook_accounting.sql
481012602c86608d25500f1a7fe732b30087b24991af8124b5d263d81ce1b45d  20260809120000_payment_recovery_policy.sql
4ebd4c750ea632f03ca2a0803db862d35b2ccee45dd10a5e14de6f2cb49060b8  20260811120000_auth_hook_archived_org_guard.sql
9f19184eca80b8c8ee22774cbf8c5c279c75c75450e7887f4eb18214a892b77f  20260812120000_company_preferred_locale.sql
9d647fff854cc285075f87fe1f554451445ae274c3c34907d8e38c2fbd181bd3  20260813120000_markets_global_launch_readiness.sql
e377842d9971e309bce41fcba1625df9256b9490c9019036ee5b69a16c142f4e  20260814120000_market_timezone_cutoff.sql
```

(12 av disse — 20260729…20260809 — er sporet ved forrige commit og uendret av dette oppdraget; 4 er nye i denne releasen.)

## 5. Testresultater bundet til release-treet (kjørt 2026-07-11 16:18–16:37)

| Gate | Resultat |
|------|----------|
| typecheck | PASS (exit 0) |
| lint | PASS (exit 0) |
| unit/integration (vitest) | 5382 bestått · 0 feilet · 178 env-gatede skips |
| golden path | 103/103 PASS |
| build:enterprise | PASS (exit 0) |
| Kritisk Playwright E2E (production-build + staging) | 104/104 · 0 feilet · 0 skippet |
| Billing prod-simulering (`billing-prod-sim-verify.mjs`) | VERIFY PASS |
| Post-migration verify (simulert full release) | PASS |
| Production preflight (read-only mot `hkpokyapzarefrgqzkos`) | PASS (49 applied · 16 pending · 12 out-of-order · ingen drift) |
