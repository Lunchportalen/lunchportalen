# PRODUCTION READ-ONLY EVIDENCE — Lunchportalen

Dato: 2026-07-13 (natt) · Alle kontroller read-only. **Production mutation performed: NO.**
Ingen secrets, tokens, passord eller URL-verdier er lest ut eller logget (kun env-NAVN).

## Identitet

| Element | Verdi |
|---|---|
| Vercel prosjekt | lunchportalen/lunchportalen, region dub1 |
| Production-deploy | `dpl_4vG5PyoKrV5rffBgJrPQtjybsraL`, Ready, 2026-07-11 20:44, alias app.lunchportalen.no |
| **Production SHA** | `ada0183b44d2814bfe0294f30952cdb59dbf895c` («release: global launch production candidate») — bekreftet av `/api/health` `data.version` |
| origin/main SHA | `13aa59a8` — production-SHA er IKKE ancestor av origin/main (deployet fra `fix/go-operator-open-pr`) |
| Lokal HEAD | `a9c3e0fd` (upushet branch `fix/correct-21-country-market-model`, 2 commits foran production) |
| Supabase | `hkpokyapzarefrgqzkos`, eu-west-1, Postgres 17.6, ACTIVE_HEALTHY |
| Sanity | prosjekt `4udoq5d8`, datasets `production` + `staging` |
| Helse | `/api/health` → ok=true, runtime remote_backend ok, supabase ok, sanity ok, env ok (rid returnert; API-kontrakt `{ok, rid, data}` overholdt) |

## Vercel production env (KUN navn)

LP_LOCALIZED_FIXED_MENU_GENERATOR, LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK, LP_MENU_PROFILE_RESOLVER, NEXT_PUBLIC_SANITY_* (4), SENTRY_* (5), TRIPLETEX_BASE_URL, TRIPLETEX_CONSUMER_TOKEN, TRIPLETEX_PROVIDER_ENV, SANITY_WRITE_TOKEN, SANITY_WEBHOOK_SECRET, LP_RESEND_LIVE_SEND, RESEND_API_KEY, LP_RESEND_FROM, PUBLIC_APP_URL, SANITY_LIVE_URL, SUPABASE_DB_PASSWORD, SMTP_* (5), LP_SMTP_* (5), NEXT_PUBLIC_APP_URL, UMBRACO_* (3), CRON_SECRET, SYSTEM_MOTOR_SECRET, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SANITY_API_VERSION.

**Fravær (kritisk):** Ingen `STRIPE_SECRET_KEY`, ingen `STRIPE_*_WEBHOOK_SECRET`, ingen `STRIPE_PRICE_*`. Ingen `LP_LOCALIZED_GENERATOR_SOT_*` (SOT-flagg av). → **Stripe live-konfigurasjon: MISSING.**

**Nærvær (viktig for doc-truth):** `LP_MENU_PROFILE_RESOLVER`, `LP_LOCALIZED_FIXED_MENU_GENERATOR` og `LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK` FINNES i production env (satt 8–9 dager før audit). Dette bekrefter at launch-dokumentenes påstand «alle LP_MENU_PROFILE_* er OFF i production» (2026-06-30/07-01) er historisk og superseded av SUPERSMART Phase 4-cutover 2026-07-04; autoritativ nå-tilstand er `docs/evidence/go-truth-state-reconciliation-2026-07-10.md` (resolver+generator ON, SOT contained OFF).

## Supabase production-schema (read-only)

- Migrasjonshistorikk: baseline `20260528000000` → **siste kjørte `20260814120000_market_timezone_cutoff`**. Lokale migrasjoner `20260815/20260816/20260817` (nl + 21-land-korreksjon) er IKKE kjørt.
- Global Billing Engine-migrasjoner `20260729`–`20260809` ER kjørt i prod (motbeviser docs/TECH-DEBT.md).
- RLS: 293 policies på 108 tabeller; alle public-tabeller har rls_enabled=true.
- Nøkkel-RPC-er verifisert til stede: `lp_order_set`, `lp_order_advance_status`, `lp_company_register`, `lp_company_registration_approve_provider`, `lp_agreement_approve_active`, `lp_match_provider_by_postal_code`, `lp_provider_create`, `lp_capture_lead`, `lp_service_area_save`, `lp_billing_close_commission_period`, `lp_billing_create_commission_invoice`, `lp_billing_stripe_charge_dry_run`, `lp_run_daily_agreement_billing`, m.fl. (SECURITY DEFINER der forventet).
- pg_cron: kun 1 jobb (`audit_log_create_partitions`, månedlig). All annen scheduling via Vercel-cron.

## Production-data (aggregater, ingen PII)

| Tabell | Rader | Merknad |
|---|---|---|
| providers | 9 (alle ACTIVE) | matcher 9 Sanity provider-docs |
| companies / company_locations / agreements | 5 / 5 / 4 | |
| profiles | 50 · roller: superadmin, company_admin, employee, kitchen, driver, provider_admin · preferred_locale: kun `nb` | |
| orders / order_items / order_status_history | 17 / 10 / 28 · statuser: ACTIVE, CANCELLED (7), DELIVERED, PREPARED | statusflyt bevist i prod |
| day_choices | 9 (kun ACTIVE) | |
| menu_service_days / menu_service_day_items / menu_visibility_days | 79 / 297 / 63 | materialisering LIVE |
| company_registrations | 2 (begge APPROVED) | |
| employee_invites / company_invites | 1 / 2 | |
| provider_service_areas | 1 | |
| provider_price_rules / provider_settings / provider_package_entitlements | 3 / 9 / 18 | inert-konfig |
| markets | 21 rader — GAMMEL modell: AU/SG/LU aktive, PL/RO/CZ/PT/GR mangler, BE×2, CH×2; NO har stripe_status='configured' | motsier Stripe-env-fravær |
| agreement_invoices / lines | 3 / 3 — alle **DRAFT**, tripletex_invoice_id=null, sent_at=null | E1 stopper før oversendelse |
| provider_tripletex_credentials / products / webhook_* | 0 / 0 / 0 | ingen provider koblet til Tripletex |
| commission_* / order_line_commercial_snapshots / billing_payment_attempts / provider_commission_invoices / invoice_deliveries / billing_audit_log | **0 rader i alle** · commission_rules = 1 (LP_GLOBAL_5P, 500 bps, NET_LUNCH_MENU_SALES_EX_TAX) | E2 dormant |
| invoice_runs / invoice_lines / tripletex_invoices (legacy K2) | 0 | |
| outbox | 85 · SENT: daily_order_summary (16), daily_kitchen_production (16), order.set/rollup (11+11), deviation (9), company.approved (2) · **PENDING: tripletex.provider_customer_create_lp (8), tripletex.agreement_invoice_create_provider (3), product_sync (2), company_customer_create (2) · FAILED_PERMANENT: 1** | e-post virker; Tripletex-kø fastlåst |
| audit_log-partisjoner | y2026m05: 19 200, m06: 918, m07: 245 | audit aktiv |
| kitchen_batches / deliveries / driver_runs / production_days | 0 | batch/levering ikke brukt i prod ennå; legacy død |

## Sanity production (read-only GROQ)

- Dokumenttyper: provider (9), menuDay (331), lunchCategory, mealIdea. 0 drafts.
- menuDay har INGEN locale-verdier (`locale: null` overalt) — flerspråklig menyinnhold finnes ikke i prod-datasettet.
- Provider-speil-id-er samsvarer 1:1 med Supabase providers.id. 8 av 9 providers er «*Lunch Pilot»-organisasjoner (SE/DK/FI/DE/FR/ES/IT/UK) + Melhus Catering AS.

## Lokale gates kjørt (mot lokal HEAD, read-only) — eksakte tall

| Gate | Resultat |
|---|---|
| `npm run typecheck` | PASS (exit 0) |
| `npm run lint` | PASS (kun design-token-warnings). NB: `scripts/lint-ci.mjs` er inert (alltid exit 0) — det er `next lint` som ble kjørt og passerte |
| `npm run build:enterprise` | PASS (exit 0, 22 min 25 s) — inkluderer 9 guard-scripts (api-contract, status-code, mock-integrity, cms-integrity, ai-governance, ui-clickable, commercial-hardcodes, agents-check, verify-control-coverage) |
| `npm run test:run` (hele vitest-suiten) | **760 testfiler: 727 passed · 32 skipped (env-gated) · 1 failed** — 5 853 tester: 5 674 passed / 178 skipped / 1 failed. Feilen (`localized-generator-sot-runtime-hook-governance-contracts` «SOT flag tokens appear only in allowed paths») var 120 s-timeout under full parallellast og **passerer 15/15 ved isolert re-kjøring** (110,9 s). Rapporteres som timeout-under-last, ikke som skjult PASS |
| `npm run test:golden-path` | **PASS 103/103** (9 filer) |
| `node scripts/ci/verify-21-language-e2e.mjs` | PASS (kjørt av lesagent) — men porten er strukturell (nøkler/interpolasjon/mojibake), den validerer IKKE at strenginnhold er på målspråket |
| RLS-suiten (7 filer), Playwright (54), smoke (38), k6 (27), cua (2) | IKKE KJØRT (staging-muterende / env-gated / manuelle) → UNVERIFIED — REQUIRES CONTROLLED STAGING EXECUTION |

## Stripe

Ingen live-kontokontroll utført (ingen nøkkel i env). Koden forventer STRIPE_SECRET_KEY, STRIPE_BILLING_PAYMENTS_WEBHOOK_SECRET, STRIPE_PROVIDER_SETUP_WEBHOOK_SECRET, STRIPE_WEBHOOK_SECRET (fallback), STRIPE_PRICE_BASIC/PRO/ENTERPRISE. **Status: MISSING / LIVE CONFIGURATION MISSING.**

## Umbraco/Azure-bekreftelse

Umbraco-filer endret: **0** · Umbraco-workflows endret: **0** · Azure-ressurser endret: **0** · lunchportalen.no påvirket: **nei**.
