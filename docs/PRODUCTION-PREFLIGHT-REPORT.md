# Production migration preflight report

Generated: 2026-07-11T14:21:37.658Z · Mode: READ-ONLY (session tvunget read-only) · Resultat: **PREFLIGHT PASS**

| Felt | Verdi |
|------|-------|
| Production project ref | `hkpokyapzarefrgqzkos` (verifisert via tilkoblingsbruker; secrets ikke gjengitt) |
| Release SHA (arbeidstre) | `9b8655a9ee8436b9b10ecf7ce812b7f6f6574275` + uncommitted release-endringer (se FASE 0-rapport — SHA-entydighet krever commit før app-deploy) |
| Kjørt fra | Lokal operatørmaskin, `scripts/ci/production-migration-preflight.mjs` |
| Remote applied | 49 (max `20260810120000`) |
| Pending | 16 (eksakt liste under) |
| Out-of-order | 12 (20260729–20260809 sorterer før max applied) → `--include-all` OBLIGATORISK |
| History-drift | Ingen (0 remote-only versjoner) |
| Billingtabeller pre-state | 0/13 til stede (ren pre-billing base — forventet; aldri delvis) |
| Billing-RPC-er pre-state | 0/13 til stede (konsistent) |
| Policies/grants/search_path | Verifiseres post-migration av `scripts/ci/post-migration-verify.mjs` (forventning: 13 tabeller RLS+policies, 13 SECDEF-RPC-er m/pinned search_path, 0 anon-grants) |
| Auth hook pre-state | `custom_access_token_hook` TIL STEDE (Fase 2-shadow); arkiv-guard (`lp_org_is_archived`) kommer i `20260811120000` |
| Cutoff-wiring pre-state | Oslo-inline (erstattes av `lp_company_cutoff_context` i `20260814120000`) |
| Markeder pre-state | `markets`-tabell finnes ikke ennå (opprettes i `20260729120000`; 21 rader komplett etter `20260813120000`) |
| Backupstatus | **MÅ BEKREFTES AV OPERATØR** i Supabase Dashboard (PITR aktiv + manuelt snapshot) — kan ikke verifiseres read-only herfra |
| Rollbackgrunnlag | Migrasjonene er additive (ingen DROP/DELETE/TRUNCATE av businessdata — verifisert i migrasjonsanalyse); rollback = kill switches + app-rollback + PITR som siste utvei (runbook §3) |

Release command (krever operatørgodkjenning):

```text
npx supabase db push --db-url "<DATABASE_URL for prod fra sikker secret-kilde>" --include-all
```

## Migrations (65 local)

| # | Version | Fil | Status |
|---|---------|-----|--------|
| 1 | 20260528000000 | 20260528000000_baseline_prod_schema.sql | APPLIED |
| 2 | 20260529120000 | 20260529120000_tpt_b2_flow_b_mapping.sql | APPLIED |
| 3 | 20260530120000 | 20260530120000_tpt_b3_agreement_invoices.sql | APPLIED |
| 4 | 20260530123000 | 20260530123000_tg_orders_hydrate_provider_id.sql | APPLIED |
| 5 | 20260531120000 | 20260531120000_tpt_b5_billing_scheduler.sql | APPLIED |
| 6 | 20260601120000 | 20260601120000_tpt_b6_webhook_paid_status.sql | APPLIED |
| 7 | 20260602120000 | 20260602120000_tpt_b5b_agreement_lifecycle_hooks.sql | APPLIED |
| 8 | 20260603120000 | 20260603120000_tpt_b7_foundation.sql | APPLIED |
| 9 | 20260603120100 | 20260603120100_tpt_b7_foundation_fix.sql | APPLIED |
| 10 | 20260604120000 | 20260604120000_tpt_b7_hotfix_guard_order.sql | APPLIED |
| 11 | 20260605120000 | 20260605120000_tpt_b7_hotfix5_verify_audit_diag.sql | APPLIED |
| 12 | 20260606120000 | 20260606120000_tpt_b7_hotfix6_outbox_grants.sql | APPLIED |
| 13 | 20260607120000 | 20260607120000_tpt_b7_hotfix8_service_role_grants.sql | APPLIED |
| 14 | 20260608120000 | 20260608120000_tpt_b7_polish9_webhook_subscriptions.sql | APPLIED |
| 15 | 20260609120000 | 20260609120000_dc018_enable_rls_billing.sql | APPLIED |
| 16 | 20260609130000 | 20260609130000_dc019_enable_rls_tenant_tables.sql | APPLIED |
| 17 | 20260609150000 | 20260609150000_revoke_internal_rpc_execute_lockdown.sql | APPLIED |
| 18 | 20260610120000 | 20260610120000_lp_pgrst_reload_schema.sql | APPLIED |
| 19 | 20260610130000 | 20260610130000_lp_order_set_varmmat_msdi_alias.sql | APPLIED |
| 20 | 20260611120000 | 20260611120000_lp_order_set_variant_itemkey.sql | APPLIED |
| 21 | 20260612120000 | 20260612120000_lp_order_set_lifecycle_robustness.sql | APPLIED |
| 22 | 20260615120000 | 20260615120000_lp_user_allergens_foundation.sql | APPLIED |
| 23 | 20260616110410 | 20260616110410_lp_order_advance_status_provider_after_cutoff.sql | APPLIED |
| 24 | 20260616120000 | 20260616120000_audit_log_partition_rls_harden.sql | APPLIED |
| 25 | 20260617120000 | 20260617120000_lp_allergen_code_subtypes.sql | APPLIED |
| 26 | 20260618120000 | 20260618120000_lp_company_lifecycle_strict_provider_gate.sql | APPLIED |
| 27 | 20260620183000 | 20260620183000_menu_week_opening_notifications.sql | APPLIED |
| 28 | 20260630120000 | 20260630120000_ci_migration_detect_noop.sql | APPLIED |
| 29 | 20260701120000 | 20260701120000_meta_environment_sentinel.sql | APPLIED |
| 30 | 20260702120000 | 20260702120000_leads_foundation.sql | APPLIED |
| 31 | 20260703120000 | 20260703120000_fundament_identity_spine_phase1.sql | APPLIED |
| 32 | 20260707120000 | 20260707120000_fundament_identity_spine_phase1_review_adjustments.sql | APPLIED |
| 33 | 20260708120000 | 20260708120000_fundament_identity_spine_phase2_auth_hook_shadow.sql | APPLIED |
| 34 | 20260709120000 | 20260709120000_leads_geography_coverage.sql | APPLIED |
| 35 | 20260710120000 | 20260710120000_provider_config_foundation.sql | APPLIED |
| 36 | 20260711120000 | 20260711120000_provider_config_fk_reconcile.sql | APPLIED |
| 37 | 20260713120000 | 20260713120000_batch_order_status_sync.sql | APPLIED |
| 38 | 20260714120000 | 20260714120000_provider_operational_contacts.sql | APPLIED |
| 39 | 20260715120000 | 20260715120000_lp_company_register_provider_scope.sql | APPLIED |
| 40 | 20260716120000 | 20260716120000_agreement_change_requests.sql | APPLIED |
| 41 | 20260718120000 | 20260718120000_profiles_preferred_locale.sql | APPLIED |
| 42 | 20260722120000 | 20260722120000_profiles_preferred_locale_eight_locales.sql | APPLIED |
| 43 | 20260723120000 | 20260723120000_provider_price_rules_market_columns.sql | APPLIED |
| 44 | 20260724120000 | 20260724120000_provider_price_rules_market_unique_index.sql | APPLIED |
| 45 | 20260725120000 | 20260725120000_provider_settings_menu_profile_id.sql | APPLIED |
| 46 | 20260726120000 | 20260726120000_profiles_preferred_locale_nine_locales.sql | APPLIED |
| 47 | 20260727120000 | 20260727120000_provider_menu_profile_runtime_mapping_drafts.sql | APPLIED |
| 48 | 20260728120000 | 20260728120000_menu_content_translations.sql | APPLIED |
| 49 | 20260729120000 | 20260729120000_global_billing_engine_foundation.sql | PENDING (out-of-order) |
| 50 | 20260730120000 | 20260730120000_order_billing_snapshot_ledger_wiring.sql | PENDING (out-of-order) |
| 51 | 20260731120000 | 20260731120000_billing_readiness_observability.sql | PENDING (out-of-order) |
| 52 | 20260801120000 | 20260801120000_commission_correction_negative_ledger.sql | PENDING (out-of-order) |
| 53 | 20260802120000 | 20260802120000_payment_invoice_readiness_policy.sql | PENDING (out-of-order) |
| 54 | 20260803120000 | 20260803120000_stripe_setup_intent_onboarding.sql | PENDING (out-of-order) |
| 55 | 20260804120000 | 20260804120000_invoice_close_dry_run.sql | PENDING (out-of-order) |
| 56 | 20260805120000 | 20260805120000_final_commission_invoice_creation.sql | PENDING (out-of-order) |
| 57 | 20260806120000 | 20260806120000_stripe_charge_dry_run.sql | PENDING (out-of-order) |
| 58 | 20260807120000 | 20260807120000_stripe_off_session_charge_attempts.sql | PENDING (out-of-order) |
| 59 | 20260808120000 | 20260808120000_stripe_payment_webhook_accounting.sql | PENDING (out-of-order) |
| 60 | 20260809120000 | 20260809120000_payment_recovery_policy.sql | PENDING (out-of-order) |
| 61 | 20260810120000 | 20260810120000_msdi_localized_sot_snapshot_trigger_alignment.sql | APPLIED |
| 62 | 20260811120000 | 20260811120000_auth_hook_archived_org_guard.sql | PENDING |
| 63 | 20260812120000 | 20260812120000_company_preferred_locale.sql | PENDING |
| 64 | 20260813120000 | 20260813120000_markets_global_launch_readiness.sql | PENDING |
| 65 | 20260814120000 | 20260814120000_market_timezone_cutoff.sql | PENDING |

## Billing block — tables (0/13 present)

| Tabell | Status |
|--------|--------|
| markets | PENDING (applied by push) |
| organization_billing_profiles | PENDING (applied by push) |
| payment_methods | PENDING (applied by push) |
| order_line_commercial_snapshots | PENDING (applied by push) |
| commission_rules | PENDING (applied by push) |
| commission_ledger | PENDING (applied by push) |
| commission_periods | PENDING (applied by push) |
| provider_commission_invoices | PENDING (applied by push) |
| invoice_deliveries | PENDING (applied by push) |
| billing_audit_log | PENDING (applied by push) |
| billing_readiness_events | PENDING (applied by push) |
| billing_payment_attempts | PENDING (applied by push) |
| stripe_billing_webhook_events | PENDING (applied by push) |

## Billing block — RPCs (0/13 present)

| RPC | Status |
|-----|--------|
| lp_billing_post_commission_for_order | PENDING (applied by push) |
| lp_billing_post_delivered_commission | PENDING (applied by push) |
| lp_billing_post_negative_commission_for_order | PENDING (applied by push) |
| lp_billing_create_order_line_snapshot | PENDING (applied by push) |
| lp_billing_close_commission_period | PENDING (applied by push) |
| lp_billing_create_commission_invoice | PENDING (applied by push) |
| lp_billing_create_provider_commission_invoice | PENDING (applied by push) |
| lp_billing_invoice_close_dry_run | PENDING (applied by push) |
| lp_billing_payment_readiness | PENDING (applied by push) |
| lp_billing_provider_readiness | PENDING (applied by push) |
| lp_billing_stripe_charge_dry_run | PENDING (applied by push) |
| lp_billing_apply_payment_recovery_policy | PENDING (applied by push) |
| lp_billing_payment_recovery_status | PENDING (applied by push) |

## Pre-state invariants

- custom_access_token_hook: PRESENT
- RLS core tenant tables: ALL ENABLED
- lp_order_set SECURITY DEFINER: OK
- History drift (remote-only versions): none

Resultat: PREFLIGHT PASS
