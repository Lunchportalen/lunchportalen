# END-TO-END SYSTEM MAP — Lunchportalen

Dato: 2026-07-13 · Read-only audit · Lokal HEAD `a9c3e0fd` · Production `ada0183b`

## Arkitektur (overordnet)

- **Frontend/backend:** Next.js App Router (Vercel, region dub1), server-side auth-gating i layouts, middleware kun for uautentisert tilgang + locale-cookie (`x-lp-locale`).
- **Database:** Supabase Postgres (prosjekt `hkpokyapzarefrgqzkos`, eu-west-1). 293 RLS-policies over 108 tabeller. Skrivevei for ordre er SECURITY DEFINER-RPC (`lp_order_set`).
- **CMS:** Sanity (prosjekt `4udoq5d8`, datasets `production`/`staging`). Menyinnhold (menuDay, lunchCategory, mealIdea, provider-speil).
- **E-post:** To stacker — Resend (`lib/email/send.ts`, gated av `LP_RESEND_LIVE_SEND`) og SMTP/nodemailer (`lib/orderBackup/smtp.ts`). Outbox-tabell + `/api/cron/outbox` (hvert 2. min).
- **Cron:** 13 Vercel-crons (vercel.json): week-scheduler, outbox, tripletex-outbox, tripletex-agreements-daily, tripletex-saas-monthly, menu-service-day-reconcile, menu-week-rollout, cleanup-invites m.fl. Ingen cron for commission period close.
- **Marketing-site:** Umbraco/Azure (lunchportalen.no) — utenfor scope, urørt.

## Dataeierskap (fastslått)

| Konsept | Eier / kilde |
|---|---|
| Meny (innhold) | Provider via Sanity `menuDay` + `lunchCategory`; Supabase MSD/MSDI er derivert speil |
| Pris (visning) | `provider_price_rules` når rader finnes, ellers hardkodet tier-fallback (`tierPricing.ts` 90/130/170) |
| Pris (fakturagrunnlag) | `order_items`-snapshot ved ordreinnsetting; MSDI `offered_price_cents_ex_vat` |
| Pakke/tier | Company-avtale: `agreements.tier` + `agreement_delivery_days` per ukedag |
| `provider_package_entitlements` | INERT — ingen runtime-lesing |
| Cutoff | DB: `lp_company_cutoff_context` (market-timezone-aware, 20260814) + trigger `tg_orders_cutoff_0800`; deler av `/api/week` bruker fortsatt hardkodet Oslo 08:00 |
| Faste valg | Sanity `lunchCategory` (provider-eid) |
| Company-valg | Avtale (leveringsdager + tier per dag); endring kun via `agreement_change_requests` |
| Employee-valg | `lp_order_set` (choice_key/item_key) → orders/order_items/day_choices |

## Domener → routes / RPC / tabeller / status

### 1–5. Provider registration → settings → coverage
- UI: `/start` (lead-intake, `lead_type=provider`) → `POST /api/public/leads/capture` → RPC `lp_capture_lead` → tabell `leads` + salgs-epost. **Ingen konvertering lead→provider.**
- Provider-org opprettes KUN via `lp_provider_create` (platform-admin-gated) / Phase C operator-CLI (`lib/provider-onboarding/**`): providers + organizations + provider_settings + auth-user + provider_memberships + Sanity-provider-speil. Første provider-admin opprettes direkte (ingen invitasjonstoken).
- Settings: `/leverandor/innstillinger` (profil, ops/kjøkken/leverings-epost i `provider_settings`, locale→menu_profile_id, Tripletex-wizard). Dekning: `/leverandor/omrader` → `provider_service_areas` (RPC `lp_service_area_save`). Prisregler/pakker/cutoff: DB-tabeller finnes, INGEN provider-UI (inert).

### 6–9. Company registration → matching → agreement → admin
- To parallelle løp: (A) `/registrering` → `POST /api/public/register-company` → RPC `lp_company_register` (company+agreement+registration alle PENDING, provider matchet fail-closed via `lp_match_provider_by_postal_code`); (B) `/registrer` → RPC `lp_company_registration_create` (kun registration, company_id NULL) → provider godkjenner i `/leverandor/registreringer` → RPC `lp_company_registration_approve_provider` (oppretter company ACTIVE + NY ACTIVE-avtale + company_invites).
- Superadmin-løp: `/superadmin/registrations` → `lp_agreement_approve_active` / `lp_agreement_reject_pending` + company_invites + outbox `company.approved`. NB: plan-felter (weekday_meal_tiers m.m.) materialiseres IKKE inn i avtalen ved superadmin-godkjenning.
- Company admin: `/admin/**`, server-gate `profiles.company_id` + aktiv avtale-gate (`/avtale-ikke-aktiv`). Locations: liste + aktiver/deaktiver (ingen adresse-CRUD). Fakturaprofil: read-only. Koststed: MANGLER. FirmaOnboardingWizard: UI uten server-persistens.

### 10–12. Employee invitation → acceptance → login
- `employee_invites` (token_hash SHA-256; TTL 48t Resend-løp vs 7d SMTP-løp). Kanonisk aksept: `/register/employee?token=` → `POST /api/auth/accept-invite` (auth-user + profilbinding company/location + used_at). Legacy duplikat: `/accept-invite` + `/api/accept-invite/complete` (setter ikke location_id). Login etter aksept går direkte til `/week` (forbi `/api/auth/post-login`).
- Post-login-resolver: `/api/auth/post-login` (rolle→home, employee krever aktiv avtale, next-allowlist).

### 15–19. Meny: provider → Sanity → publish → materialisering → week
- `/leverandor/meny` → `POST /api/provider/menu-days` → Sanity `menuDay` (`approvedForPublish`+`customerVisible`) → webhook `/api/webhooks/sanity/menu-day` + direktesync + cron reconcile (6t) → `menu_service_days` + `menu_service_day_items` (MSDI-snapshot-trigger 20260810). `menu_visibility_days` = CMS-speil, ikke employee-lesevei.
- `/api/week`: Sanity primær, MSDI-fallback. `/api/order/window` driver faktisk week-UI (parallell lesemodell) og har SMART-1-oversettelsesoverlay.
- Localized generator SOT: master-flagg default OFF, resolver alltid fail-closed til legacy; Phase D = SOURCE_ONLY.

### 20–23. Ordre / endring / kansellering
- `POST /api/orders` (Idempotency-Key) → RPC `lp_order_set` (SET/CANCEL) → orders + order_items + day_choices + outbox (`order.set`, `rollup.rebuild`). Ingen ukesbulk (bulk-set = 410 DEPRECATED). CANCEL: orders.status=CANCELLED, day_choices SLETTES, order_items slettes. Cutoff i DB (`lp_company_cutoff_context` + `tg_orders_cutoff_0800`).
- Ingen automatisk billing-/provisjonskorreksjon på kansellering (negativ-ledger-RPC finnes, kalles ikke fra `lp_order_set`).

### Runtime-flagg i production (verifisert mot Vercel-env)
- PÅ: `LP_MENU_PROFILE_RESOLVER`, `LP_LOCALIZED_FIXED_MENU_GENERATOR`, `LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK` (observe-only hook), `LP_RESEND_LIVE_SEND`.
- AV/fraværende: alle `LP_LOCALIZED_GENERATOR_SOT_*`, alle `STRIPE_*`, G5d-shadow/cutover-flagg, `TRIPLETEX_FLOW_1_ENABLED`.
- Kill-switches (system_settings): alle default åpne; autonomy default av.

### 24–28. Kjøkken / status / pakking / levering / varsler
- Faktisk statusmodell: `orders.status` ACTIVE/LOCKED → PREPARED → DISPATCHED → DELIVERED (+CANCELLED/PAUSED) via `lp_order_advance_status` (provider-gated, post-cutoff GUC), parallell batchmodell `kitchen_batches` QUEUED→PACKED→DELIVERED via `lp_batch_transition_and_sync_orders`. Den «kanoniske» kjeden confirmed/ready/in_production/packed/out_for_delivery finnes IKKE.
- UI: `/leverandor/ordrer` (per-ordre, provider), `/kitchen` (tenant-produksjon + aggregat + allergener fra `lp_user_allergens` og CMS), `/driver` (stopp + Markér levert). Legacy-tabeller production_days/driver_runs/deliveries/delivery_runs: UBRUKT av app.
- Kansellerte fjernes fra `/kitchen`/driver (kun ACTIVE + day_choices-filter); provider-ordreliste ekskluderer IKKE CANCELLED automatisk.
- Varsler: outbox→cron→SMTP: `batch_packed`, `daily_order_summary` (08:05), `daily_kitchen_production`, `deviation`; mottakere fra `provider_settings` (kitchen/operations/delivery-email, fail-closed).

### 29. Provider → company-fakturering (E1)
- `lp_run_daily_agreement_billing` (cron 06:00) → `lp_generate_agreement_invoice_core` → `agreement_invoices`+`agreement_invoice_lines` (DRAFT, forfall +14d, fakturanr `AGR-{slug}-…`) → outbox `tripletex.agreement_invoice_create_provider` → Tripletex Flow B (krever `provider_tripletex_credentials`; 0 rader i prod → permanent blokkert) → webhook betalstatus (SENT→PAID). Kreditnota: MANGLER (kun manuell VOID). Provider-UI for agreement-fakturaer: MANGLER (faktura-siden viser SaaS-abonnement).

### 30. Platform → provider 5 % provisjon (E2, Global Billing Engine)
- Skjema + RPC-er FINNES I PRODUCTION (migrasjoner 20260729–20260809 er kjørt; commission_rules seedet LP_GLOBAL_5P 500 bps): order_items-trigger → `order_line_commercial_snapshots` → DELIVERED → `commission_ledger` → `lp_billing_close_commission_period` → `provider_commission_invoices` → `billing_payment_attempts` → Stripe off-session → webhooks → `billing_audit_log`.
- Blokkert i praksis: 0 rader overalt. Årsaker: (1) ingen `STRIPE_*`-env i Vercel production; (2) ingen cron for periodestenging/fakturaopprettelse (kun manuell RPC/superadmin-API); (3) snapshots krever `organization_billing_profiles`-kobling. Kill-switches finnes (`billing`, `commission_posting`, `stripe_*`).

### 31–33. Tax / regnskap / Stripe
- `markets` (21 rader i prod, gammel locale-modell) med vat_rate_food, invoice_language, cutoff, stripe_status. `billing_tax_codes`/`billing_products` (norsk MVA-basis). Regnskap = Tripletex (Flow A SaaS + Flow B agreement); ingen andre integrasjoner. Stripe: kode komplett, LIVE CONFIGURATION MISSING.

### 34. Superadmin
- 50 pages + 120 API-routes, server-layout-gate (`role !== superadmin` → redirect). Full støtte: companies (FROZEN), registrations, agreements, providers (SaaS), invoices, billing-CSV, tripletex-kø, outbox, CFO (inkl. kanselleringer), audit, system (FROZEN), production-check, operations, global/control-tower. Delvis: provider-registreringer (kun leads uten egen side), payment failures (kun Tripletex-kø), markets/valuta/tidssone (visning, ikke CRUD). Mangler: språkadministrasjon, tax-admin.

### 35. Språk/locale
- Runtime-kataloger: production 9 (nb,sv,da,de,en,es,fi,fr,it) / lokal HEAD 15 (+nl,pl,ro,cs,pt,el — UPUSHET). Markedsmodell lokal: 21 land / 15 språk / 24 markedslocales (`lib/markets/supportedMarkets.ts`). Superadmin-UI: hardkodet norsk (0 next-intl-bruk), utenlandsk fritekst vises rått, ingen maskin-/lagret oversettelse for superadmin (`lib/i18n/translate.ts` er stub).

### 36–37. Audit/observability / support
- `audit_log` (partisjonert, cron for partisjoner), `lifecycle_audit_log`, `billing_audit_log`, `ops_events`, `system_incidents`, `repair_jobs`, Sentry. Flytdiagnostikk i `/superadmin/system` (FROZEN).
