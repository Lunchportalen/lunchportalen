# FLOW STATUS MATRIX — Lunchportalen

Dato: 2026-07-13 (revidert etter komplett fullesning, Unread = 0)
Statuser: LIVE_VERIFIED / CODE_COMPLETE_NOT_LIVE / PARTIAL / MISSING / BROKEN / UNVERIFIED / TEST_ONLY / DOCUMENTED_ONLY
LIVE_VERIFIED brukes kun der production-runtime-bevis finnes (prod-DB-rader, outbox-SENT, deployet route + helsesjekk). Ren kodeeksistens uten prod-bevis er maks CODE_COMPLETE_NOT_LIVE/UNVERIFIED.
Kolonner per rad: UI · API/action · Auth/middleware · RPC/DB · RLS · Side effects/outbox · E-post · Test · Prod-evidens · Status · Blocker.

## Flyt 1 — Cateringfirma registrerer seg

| Steg | UI | API/action | Auth | RPC/DB | RLS | Outbox | E-post | Test | Prod-evidens | Status | Blocker |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Lead-intake | `/start` (ProviderIntakeForm) | `POST /api/public/leads/capture` | public (rate-limit prosesslokal) | `lp_capture_lead` → `leads` | deny-by-default | — | salgsvarsel («Ny leverandørinteresse») | publicLeadsCaptureRoute.test | leads=0 rader, route deployet | LIVE_VERIFIED (intake) | — |
| Lead → provider-konvertering | — | — | — | — | — | — | — | — | — | **MISSING** | Ingen kode |
| Provider-org opprettelse | ingen UI | operator-CLI (Phase C, `PHASE_C_ALLOW_LIVE_ONBOARD=1`) | `is_platform_admin()` i RPC | `lp_provider_create` → providers+organizations+provider_settings+memberships | service-gate i RPC | outbox `tripletex.provider_customer_create_lp` | — | lp_provider_create.test, onboardingExecute.test | 9 providers ACTIVE i prod; 8 PENDING-outbox fastlåst | PARTIAL | Ingen superadmin-UI; outbox-kø død uten Tripletex-creds |
| Første provider-admin | — | CLI direct `auth.admin.createUser` | — | profiles + provider_memberships | profiles-RLS | — | nei (passord lagres lokalt hos operatør) | onboarding-tester | 9 provider_memberships | PARTIAL | Ingen invite-token-flyt |
| Provider-settings (profil/ops-eposter/locale) | `/leverandor/innstillinger` | server actions | server layout-gate (`canAccessProvider`) | providers + provider_settings | provider-RLS (spine-JWT-avhengig for config-tabeller) | — | — | providerOperationalSettings.test | 9 provider_settings-rader | LIVE_VERIFIED | provider_config-RLS avhenger av auth-hook som er skyggemodus |
| Land/valuta/MVA/faktura per provider | visning only | — | — | kolonner finnes (provider_settings, price_rules.vat_rate) | — | — | — | — | — | PARTIAL | Ingen redigerings-UI |
| Dekningsområder | `/leverandor/omrader` | server action | layout-gate | `lp_service_area_save` → provider_service_areas | RLS + overlappsjekk | — | — | service-area-schema.test | 1 rad i prod | LIVE_VERIFIED | — |
| Prisregler | ingen UI (preview-flagg `LP_PROVIDER_PRICE_PREVIEW_DISPLAY` default off) | — | — | provider_price_rules (3 rader) | RLS | — | — | providerMenuPackageSurface.test | R4D-preview ikke i runtime | PARTIAL/INERT | 5 parallelle prissannheter (r4-plan); MSDI bruker fortsatt TIER_PRICE_CENTS |
| Cutoff-konfig | ingen UI | — | — | provider_settings.cutoff_time (default 08:00) | — | — | — | — | DB-cutoff via market-context | MISSING (UI) | — |
| Pakke-entitlements | ingen | ingen | — | provider_package_entitlements (18 rader) | RLS | — | — | ingen runtime-test | 0 runtime-lesing | MISSING (runtime) | Eksplisitt inert |
| Sanity-speil | — | syncProviderToSanity (fail-closed) | — | Sanity provider._id = providers.id | — | — | — | syncProviderToSanity.test | 9 provider-docs i Sanity prod | LIVE_VERIFIED | — |

## Flyt 2 — Lunsjfirma registrerer seg

| Steg | UI | API/action | Auth | RPC/DB | RLS | Outbox | E-post | Test | Prod-evidens | Status | Blocker |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Public form (kanonisk) | `/registrering` (+ alias `/register`) | `POST /api/public/register-company` | public; klient-`provider_id` ignoreres (bevist i test) | `lp_company_register` → companies+agreements+company_registrations (PENDING) | service-definer | — | — | public-register-company.test (inkl. provider_id-avvisning) | 2 registrations APPROVED i prod | LIVE_VERIFIED | — |
| Provider-matching | — | i RPC | — | `lp_match_provider_by_postal_code` (deterministisk, fail-closed 422) | — | — | — | lpCompanyRegisterProviderScope.test | provider_id satt på prod-rader | LIVE_VERIFIED | — |
| Alternativt løp (provider-intake) | `/registrer` | server action | public | `lp_company_registration_create` (company_id NULL) | — | — | — | registration-flow-smoke.test | — | LIVE_VERIFIED | Duale løp → duplikatavtale-risiko |
| Godkjenning (provider) | `/leverandor/registreringer` | server actions | provider-layout-gate + RPC-assert | `lp_company_registration_approve_provider` → company ACTIVE + NY ACTIVE-avtale + company_invites | provider-scoped | audit-stub for invite-epost | stub | loadProviderRegistrationsScope.test | — | LIVE_VERIFIED (kode+gates) | Invite-epost svakere enn superadmin-løpet |
| Godkjenning (superadmin) | `/superadmin/registrations` | `POST /api/superadmin/agreements/:id/approve|reject` | requireRoleOr403 superadmin | `lp_agreement_approve_active` / `lp_agreement_reject_pending` | — | outbox `company.approved` | ja (SENT i prod ×2) | superadmin.agreements-reject-pause-route.test (403 for alle andre roller) | outbox SENT | LIVE_VERIFIED | — |
| Plan-felter → avtale | — | — | — | weekday_meal_tiers lagres kun på registration | — | — | — | — | agreement_delivery_days fylles ikke fra plan i superadmin-løp | **PARTIAL** | `lp_agreement_approve_active` materialiserer ikke plan |
| Manuelt avtaleutkast | CreateAgreementDraftButton (inert infoboks) | `POST /api/superadmin/agreements` → **410** | — | `lp_agreement_create_pending` (i k4-broken-liste) | — | — | — | agreementDraftFlowDisabled.test | 410 bevist i test | MISSING (bevisst deaktivert) | — |
| Company admin-aktivering | `/registrer-bruker` | `POST /api/auth/register-company-admin` | token-hash | auth-user + profiles(company_admin) | — | — | — | — | 2 company_invites i prod | LIVE_VERIFIED | Klient redirecter til `/admin` utenom post-login-resolver |
| Fakturaprofil/koststed/ansattantall (company-admin-redigering) | mangler / read-only | — | — | companies.billing_email/ehf_* | — | — | — | — | — | PARTIAL (billing read-only) / **MISSING** (koststed, ansattantall-edit) | Ingen UI/API |
| FirmaOnboardingWizard | `/admin/firma-onboarding` | `submitAgreement` returnerer payload | admin-gate | **ingen server-write** | — | — | — | — | — | **PARTIAL (UI uten persistens)** | submitAgreement.ts:11-19 |

## Flyt 3 — Ansatt-invitasjon

| Steg | UI | API | Auth | DB | RLS | E-post | Test | Prod-evidens | Status | Blocker |
|---|---|---|---|---|---|---|---|---|---|---|
| Invite-opprettelse (enkel) | `/admin/invite` | server action / `POST /api/admin/employees/invite` | requireCompanyScopeOr403 | employee_invites (token SHA-256) | RLS enabled, 0 policies → service-only | Resend (gated LP_RESEND_LIVE_SEND) hhv. SMTP | employeeInviteEmail.test | 1 invite i prod, 26 memberships | LIVE_VERIFIED | To e-poststacker; TTL 48t vs 7d |
| Bulk-invite (≤200) | admin-UI | `app/admin/employees/invites/bulk` | admin-gate | employee_invites | service-only | SMTP sekvensiell | — | — | LIVE_VERIFIED (kode) / UNVERIFIED (bruk) | `listUsers` paginering maks 500 → konfliktsjekk PARTIAL |
| Aksept (kanonisk) | `/register/employee?token=` | `POST /api/auth/accept-invite` | token-validering | auth-user + profiles-binding (company+location) + used_at | service-admin | — | accept-invite-tester | profiler bundet i prod | LIVE_VERIFIED | Legacy-duplikat `/accept-invite` + `/api/accept-invite/complete` (setter ikke location) |
| Første login | klient `signInWithPassword` → `router.replace("/week")` | — | — | — | — | — | ContentAccessAfterLogin.test (resolver-kontrakt) | — | PARTIAL | **Omgår låst post-login-resolver** (AGENTS E5) |
| Post-login-resolver | — | `GET /api/auth/post-login` | server | rolle→home + avtale-gate + next-allowlist (employee: kun `/week`) | — | — | postLoginRedirectSafety.test | e2e auth-spec i CI | LIVE_VERIFIED | — |

## Flyt 4 — Meny og company-valg

| Steg | UI | API | RPC/DB | Side effects | Test | Prod-evidens | Status | Blocker |
|---|---|---|---|---|---|---|---|---|
| Provider menyredigering | `/leverandor/meny` | `POST /api/provider/menu-days` (+catalog) | Sanity menuDay/lunchCategory (createOrReplace) | direktesync MSD/MSDI | provider-menu-days.test, catalog-isolation.test | 331 menuDay i Sanity prod | LIVE_VERIFIED | Dokumenterte produktgap: CATALOG_PERSISTENCE_GAP, EMPLOYEE_WEEK_IMAGE_GAP |
| Publish → materialisering | — | webhook `/api/webhooks/sanity/menu-day` (fail-closed provider-scope) + reconcile-cron 6t | menu_service_days + menu_service_day_items (snapshot-trigger) | — | menu-service-day-webhook.test, sync-tester | 79 MSD + 297 MSDI i prod | LIVE_VERIFIED | — |
| Company-valg (dager/tier) | `/admin/agreement` (read + change requests) | `POST /api/admin/agreement/change-requests` | agreements + agreement_delivery_days; agreement_change_requests | — | changeRequestService.test | 16 delivery-day-rader; 0 change requests | LIVE_VERIFIED (les) / PARTIAL (endring) | change_requests har kun SELECT-RLS (writes service-only); cancel-path sjekker kun company_id (asymmetrisk) |
| Menu-profile-resolver | provider-flate | flag-gated | provider_settings.menu_profile_id | — | menuProfileResolver.test | **Flagg PÅ i prod-env** (RESOLVER + GENERATOR) | LIVE_VERIFIED (presentasjonslag) | G5d-shadow/cutover-flagg OFF; featureFlag.ts-header-kommentar er stale («defaults OFF») |
| Localized generator SOT | — | resolver alltid `selectedSource: legacy`, fail-closed | msdi_localized-snapshot-trigger (flag-gated) | — | localizedGeneratorSotResolver.test | Ingen SOT-env i prod | CODE_COMPLETE_NOT_LIVE (contained off) | F4-evidens: MSDI-navn/VAT blokkeres av snapshot-trigger for ikke-NB |
| Menyoversettelser (SMART) | `/leverandor/meny/oversettelser` | order-window-overlay (SMART-3) | menu_content_translations (1 rad) | — | employeeApprovedTranslations.test | route i prod | PARTIAL | Ikke i `/api/week`; ikke superadmin |

## Flyt 5 — Daglig/ukentlig bestilling

| Steg | UI | API | Auth | RPC/DB | RLS | Outbox | Test | Prod-evidens | Status | Blocker |
|---|---|---|---|---|---|---|---|---|---|---|
| Week-visning | `/week` (EmployeeWeekClient) | `GET /api/order/window` (primær) + `GET /api/week` (parallell) | server-gate + aktiv avtale | Sanity primær, MSDI-fallback (fail-closed uten company/location/provider) | orders-RLS (dual select-policies) | — | week-profile-lookup.test, EmployeeWeekClient.test | 17 orders i prod; helsesjekk ok | LIVE_VERIFIED | To parallelle lesemodeller (window vs week) |
| Cutoff | — | preflight + DB | `lp_company_cutoff_context` (market-TZ) + `tg_orders_cutoff_0800` | — | — | — | marketCutoffContext.test | migrasjon 20260814 kjørt i prod | LIVE_VERIFIED | 08:00 vs 08:05-doks-avvik (immutability.ts) |
| Daglig bestilling | dag-toggle | `POST /api/orders` (Idempotency-Key) | scope-gate | `lp_order_set` SET → orders+order_items+day_choices | RPC SECURITY DEFINER | `order.set` + `rollup.rebuild` | golden path 103/103; orders-idempotency.test | DELIVERED/PREPARED-ordre i prod; SENT-outbox | LIVE_VERIFIED | — |
| Prissnapshot | — | — | order_items-snapshot + MSDI offered_price | — | billing-snapshot-trigger (fail-soft) | — | msdiSnapshotMode.test | order_items i prod | LIVE_VERIFIED | commission-snapshot krever billing-profil (0 rader) |
| **Ukesbulk** | — | `POST /api/order/bulk-set` → **410** | — | — | — | — | order-legacy-day-choice-routes-deprecated.test | — | **MISSING** | Bevisst deprecated; kun per-dag |
| Historikk | mine-registrerte-dager m.fl. | server-loadere | employee-scope (user_id+company+location) | orders | RLS | — | — | sider deployet | LIVE_VERIFIED | — |

## Flyt 6 — Avbestilling

| Steg | API | RPC/DB | Side effects | E-post | Test | Prod-evidens | Status | Blocker |
|---|---|---|---|---|---|---|---|---|
| Employee-cancel før cutoff | `POST /api/orders` action=CANCEL / DELETE | `lp_order_set` CANCEL: orders→CANCELLED, order_items+day_choices SLETTES | outbox `order.set`(CANCEL-markør) + `rollup.rebuild` | ingen dedikert bekreftelse | order-cancel-response.test (uten unit_price) | 7 CANCELLED i prod | LIVE_VERIFIED | — |
| Fjerning fra kjøkken/driver | — | ACTIVE-filter + day_choices-filter | — | — | loadOperativeKitchenOrders.test | — | LIVE_VERIFIED | — |
| Fjerning fra provider-liste | — | loadKitchenOrders uten CANCELLED-eksklusjon | — | — | — | — | PARTIAL | Vises med kansellert-pill |
| Billing-/provisjonskorreksjon | — | `lp_billing_post_negative_commission_for_order` finnes, kalles IKKE fra CANCEL | — | — | commission-correction-tester (RPC-nivå) | 0 ledger-rader | **MISSING (auto)** | Manuell RPC / periodepolicy only |
| Kreditnota E1 | `/api/superadmin/invoices/reverse` → **501** for låste perioder | agreement_invoices status VOID (manuelt) | — | — | k2-invoice-reverse-dok | 3 DRAFT-fakturaer | **MISSING** | 501 CREDIT_NOTE_NOT_IMPLEMENTED |

## Flyt 7 — Kjøkken/produksjon/levering

| Steg | UI | API | Auth/RLS | RPC/DB | Test | Prod-evidens | Status | Blocker |
|---|---|---|---|---|---|---|---|---|
| Ordre → riktig provider | `/leverandor/ordrer` | loadKitchenOrders `.eq(provider_id)` | RLS + `lp_assert_provider_kitchen_access` | orders | provider-rls.test, providerProductionStatusFlow.test | provider-scopede ordre i prod | LIVE_VERIFIED | baseline har GRANT til anon på `lp_order_advance_status` (assert-gate er backstop) |
| Statusflyt | KitchenOrderCard | server action → `lp_order_advance_status` | provider-gate + post-cutoff GUC | ACTIVE/LOCKED→PREPARED→DISPATCHED→DELIVERED | golden path | order_status_history 28 rader; DELIVERED i prod | LIVE_VERIFIED | Kanonisk navnesett (confirmed/…/out_for_delivery) finnes ikke |
| Produksjonsliste | `/kitchen` | `/api/kitchen` (profil-scoped company+location) | kitchen-scope fail-closed (SCOPE_NOT_ASSIGNED) | day_choices + lp_user_allergens + CMS-allergener + operative snapshots | kitchen-route.behavior.test, systemReceiptsScope.test | route deployet | LIVE_VERIFIED | **`/api/kitchen/companies` mangler tenant-filter for kitchen-rolle**; `canAccessCompany` alltid true for kitchen/driver (guards.ts) |
| Pakking | kitchen batch-UI | `/api/kitchen/batch/*` | batch-RPC-assert | kitchen_batches → `lp_batch_transition_and_sync_orders` | batchPackedDeliveryRouting.test | 0 batch-rader i prod | CODE_COMPLETE_NOT_LIVE | Split batch-modell: `delivery_batches` vs `kitchen_batch(es)` på tvers av endepunkter; delivered-gren i ett endepunkt uoppnåelig |
| Levering | `/driver` | `/api/driver/stops` + `bulk-set` (kun delivered) | driver-scope fail-closed | batch-RPC → orders DELIVERED | tenant-isolation-driver.test (confirm=410) | 0 leveranser i prod | CODE_COMPLETE_NOT_LIVE | — |
| Varsler | — | cron outbox 2 min | — | SMTP; mottakere fra provider_settings (fail-closed) | dailySummaryProviderRouting.test | outbox SENT (16+16) t.o.m. 2026-07-10 | LIVE_VERIFIED | — |

## Flyt 8 — Provider fakturerer company (E1)

| Steg | UI | API/cron | RPC/DB | Side effects | Test | Prod-evidens | Status | Blocker |
|---|---|---|---|---|---|---|---|---|
| Fakturagrunnlag | — | cron `tripletex-agreements-daily` 06:00 | `lp_run_daily_agreement_billing` → `lp_generate_agreement_invoice_core` → agreement_invoices+lines (DRAFT, forfall +14d, nr `AGR-…`) | — | lp_run_daily_agreement_billing.test | 3 DRAFT-fakturaer generert 2026-07-11 | LIVE_VERIFIED (generering) | — |
| MVA-mapping | Tripletex-wizard | — | provider_tripletex_products | — | tpt-b2-tester | 0 rader | CODE_COMPLETE_NOT_LIVE | Krever provider-credentials |
| Oversendelse Tripletex | — | outbox `tripletex.agreement_invoice_create_provider` + cron 3 min | Flow B-klient (whoAmI-path verifisert) | — | agreementInvoiceCreateProvider.test | **PENDING ×3 + FAILED_PERMANENT ×1 i prod-outbox; 0 credentials** | **BROKEN (i praksis)** | `PROVIDER_CREDENTIALS_NOT_CONFIGURED` klassifiseres permanent |
| Betalstatus | — | webhook `/api/webhooks/tripletex-provider/[id]` (re-verifiserer via GET /v2/invoice) | SENT→PAID | — | webhook-tripletex-provider.test | ingen secrets i prod | CODE_COMPLETE_NOT_LIVE | — |
| Kreditnota | — | reverse-API → 501 | VOID-status (manuell) | — | — | — | **MISSING** | K2/K7 åpen |
| Provider-UI for agreement-fakturaer | `/leverandor/faktura` viser kun SaaS | — | — | — | faktura.test | — | **MISSING** | — |
| Regnskapseksport | superadmin CSV (legacy `company_agreements`-tier) | invoices/csv | invoice_runs (legacy K2-spor) | — | invoiceRunDb.test | 0 runs i prod | PARTIAL | To parallelle fakturaspor; mapping-API 501 |

## Flyt 9 — Lunchportalen fakturerer provider (E2, 5 %)

| Steg | RPC/DB | Cron/API | Prod-evidens | Status | Blocker |
|---|---|---|---|---|---|
| Skjema + regel | commission_rules LP_GLOBAL_5P (500 bps, NET_EX_TAX) — **verifisert i prod** | — | migrasjoner 20260729–20260814 kjørt; 1 regelrad | LIVE_VERIFIED (skjema) | — |
| Snapshot ved ordrelinje | `tg_billing_snapshot_order_item` (fail-soft NOTICE) | — | 0 rader | CODE_COMPLETE_NOT_LIVE | Krever organization_billing_profiles-kobling; fail-soft skjuler avvik (readiness-events fanger) |
| DELIVERED → ledger | `lp_order_advance_status`-wiring (Protected Golden Path-impact dokumentert) | — | 0 rader | CODE_COMPLETE_NOT_LIVE | — |
| Periodestenging + invoice | `lp_billing_close_commission_period`, `lp_billing_create_commission_invoice` | **ingen cron** — kun superadmin-API/manuell RPC | 0 rader | PARTIAL | Automasjon mangler |
| Stripe setup/charge/webhook | setup-intent, off-session charge, webhook-accounting, recovery-policy | routes i allowlist (85 statiske entries) | **ingen STRIPE_*-env i prod**; payment policy `invoice_only` (allowOnlinePayment=false) | **MISSING (LIVE CONFIGURATION MISSING)** | Env + policy + webhookregistrering |
| Audit/idempotens | append-only-guards, billing_audit_log, readiness_events | — | 0 rader | LIVE_VERIFIED (skjema) | — |

## Flyt 10 — Superadmin på norsk

| Steg | UI | Auth | Test | Prod-evidens | Status | Blocker |
|---|---|---|---|---|---|---|
| Flater (50 pages/120 APIer) | `/superadmin/**` | server-layout-gate + per-route requireRoleOr403 | superadmin-testsuiten | deployet | LIVE_VERIFIED | Enkelte gates leser `user_metadata.role` (auth.ts, invoices/export, admin/dashboard) — dual sannhet mot profiles.role |
| Norsk systemtekst | hardkodet norsk | — | — | — | LIVE_VERIFIED | Ikke next-intl; nb-NO tvunget i tier-labels |
| Utenlandsk innhold | rå originaltekst | — | — | registrations-inbox | **MISSING (oversettelse)** | translate.ts er stub; ingen språkindikator/audit |
| Frossen paginering (A1.1: 25) | superadmin-client PAGE_LIMIT=**50**; FirmsTable PAGE_SIZES 25/50/100; firms pageSize 50 | — | — | — | **BROKEN (lovbrudd)** | AGENTS.md-avvik |
| Systemhelse (FROZEN) | `/superadmin/system` | — | systemHealthAggregator.test | helsesjekk ok | LIVE_VERIFIED | To helse-semantikker i lib (normal/degraded vs ok/degraded/critical) — tekstlig avvik fra WARN/FAIL-loven |
| Markets/valuta/tidssone | visning (control-tower/global) | — | — | — | PARTIAL | Ingen CRUD; ingen språkadmin |

## Tverrgående lovbrudd/avvik mot AGENTS.md (fra fullesningen)

| Lov | Faktisk | Status |
|---|---|---|
| E5 én kanonisk post-login | Invite-/register-klienter går direkte til `/week`//`/admin` | BROKEN |
| A1.1 paginering 25 | 50 i superadmin-client og firms | BROKEN |
| S11 logo-bilde i header | Tekstmerke «LP» i AdminSidebar | BROKEN |
| F6 hot pink-aksent | `--lp-hotpink` mappet til gull `#f5c518` | AVVIK (bevisst rebrand? udokumentert) |
| API-kontrakt `{ok,rid,data}` | dobbel-ok-envelope (admin/deliveries), `{ok,rows}`-former (company-paneler), pipelineNotConfigured uten rid | PARTIAL BRUDD |
| K11 «no silent fallbacks» | lint-ci.mjs og check-admin-no-hardcoded-text.mjs alltid exit 0 (inerte guards) | BRUDD (CI-hygiene) |
