#!/usr/bin/env node
/**
 * DC-032 Del 1 helper — diff migration ledger names (stdout JSON).
 * Run after pasting staging/prod ledger from MCP into this script or use inline arrays.
 */
import fs from 'node:fs';
import path from 'node:path';

const staging = [
  ['20260520000001', 'baseline_schema_dump_from_prod_2026_05_20_v1_REROLLED'],
  ['20260520103552', 'patch_2_2_billing_products_minimal'],
  ['20260520110129', 'provider_core_schema'],
  ['20260520110133', 'provider_core_rls_baseline'],
  ['20260520110832', 'provider_id_on_existing_tables'],
  ['20260520110836', 'seed_default_provider_melhus'],
  ['20260520111649', 'provider_rls_helpers'],
  ['20260520111658', 'provider_rls_core_policies'],
  ['20260520112540', 'lifecycle_audit_log_insert_policy'],
  ['20260520112720', 'suspend_rpc_private_helpers'],
  ['20260520112800', 'suspend_rpc_public_provider'],
  ['20260520112810', 'suspend_rpc_public_company'],
  ['20260520112817', 'suspend_rpc_public_user'],
  ['20260520123437', 'lifecycle_audit_log_provider_select'],
  ['20260520125057', 'lp_order_advance_status_rpc'],
  ['20260520132900', 'company_registrations_provider_intake'],
  ['20260520132937', 'provider_registration_rpc_match_create'],
  ['20260520133112', 'provider_registration_rpc_create'],
  ['20260520133128', 'provider_registration_rpc_assert'],
  ['20260520133159', 'provider_registration_rpc_approve'],
  ['20260520133203', 'provider_registration_rpc_reject'],
  ['20260520133239', 'company_registrations_provider_intake'],
  ['20260520134829', 'provider_service_areas_admin'],
  ['20260520134925', 'patch14_lp_service_area_save'],
  ['20260520134927', 'patch14_lp_service_area_toggle'],
  ['20260520140253', 'provider_subscriptions_tables'],
  ['20260520140258', 'provider_subscriptions_rls'],
  ['20260520140306', 'patch15_lp_provider_set_subscription'],
  ['20260520140307', 'patch15_lp_provider_update_billing_contact'],
  ['20260520140308', 'patch15_lp_provider_generate_invoice'],
  ['20260520171213', 'billing_products_enterprise'],
  ['20260520191500', 'tpt0_step6_10_invoice_periods_tripletex_exports'],
  ['20260520191505', 'tpt0_tripletex_customers_repair'],
  ['20260520194814', 'tpt_a2_tripletex_customers_provider_scope'],
  ['20260520194827', 'tpt_a2_lp_provider_create_rpc_fn'],
  ['20260521002716', 'tpt_a5_cron_saas_invoice_service_role'],
  ['20260521004136', 'tpt_a6_webhook_events'],
  ['20260521005959', 'tpt_a7_admin_ui'],
  ['20260521010253', 'tpt_a7_admin_ui_entity_id_fix'],
  ['20260521011934', 'tpt_b1_provider_credentials'],
  ['20260521081634', '20260529120000_tpt_b2_flow_b_mapping'],
  ['20260521085616', '20260530120000_tpt_b3_agreement_invoices'],
  ['20260521085636', '20260530120001_tpt_b3_agreement_invoice_rpcs'],
  ['20260521095423', 'tpt_b5_billing_scheduler'],
  ['20260521103825', 'tpt_b6_webhook_paid_status'],
  ['20260521103919', 'tpt_b6_webhook_rpcs'],
  ['20260521103935', 'tpt_b6_webhook_rpcs_part2'],
  ['20260521104030', 'tpt_b6_fix_rotate_webhook_secret_search_path'],
  ['20260521131611', 'tpt_b5b_agreement_lifecycle_hooks'],
  ['20260521134758', 'tpt_b7_foundation'],
  ['20260521204424', 'tpt_b7_hotfix_guard_order'],
  ['20260522000250', 'tpt_b7_hotfix5_verify_audit_diag'],
  ['20260522010737', 'tpt_b7_hotfix6_outbox_grants'],
  ['20260522041350', 'tpt_b7_hotfix8_service_role_grants'],
  ['20260522104934', 'tpt_b7_polish5_companies_billing_profile'],
  ['20260522140727', 'tpt_b7_polish9_webhook_subscriptions'],
  ['20260522180035', 'k1_outbox_claim_event_kind_filter'],
  ['20260522201807', '20260522160000_k4_kill_esg_tables'],
  ['20260522202544', '20260522161000_k4_idem_complete_fail_ledger'],
  ['20260523150421', 'dc018_enable_rls_billing'],
  ['20260523151637', 'dc019_enable_rls_tenant_tables'],
];

const prod = [
  ['20260507182933', 'add_rls_missing_tables'],
  ['20260507182945', 'add_system_settings_autopilot_enabled'],
  ['20260507184900', 'normalize_status_enums_uppercase_v6_constraints'],
  ['20260507221936', 'create_kitchen_batches'],
  ['20260507221958', 'create_day_choices'],
  ['20260507222054', 'add_kitchen_batch_day_choices_rls_policies'],
  ['20260507222112', 'add_day_choices_date_company_user_index'],
  ['20260507233707', 'create_company_current_agreement_view'],
  ['20260507233717', 'add_agreements_start_date'],
  ['20260507235127', 'create_invite_tables'],
  ['20260507235813', 'add_companies_default_location_id'],
  ['20260508094529', 'add_rejected_agreement_status'],
  ['20260508094543', 'create_company_registrations'],
  ['20260508094547', 'extend_agreements_review_fields'],
  ['20260508094553', 'extend_company_invites_for_company_admin'],
  ['20260508101125', 'replace_lp_company_register_pending_agreement'],
  ['20260508201639', 'company_registration_approval_flow'],
  ['20260510124132', 'add_missing_fk_indexes'],
  ['20260512210721', 'tier_per_day_v2'],
  ['20260513090038', 'grant_authenticated_company_current_agreement'],
  ['20260514172458', '20260514181500_day_choices_item_columns'],
  ['20260515105442', 'consolidate_locations_to_company_locations'],
  ['20260515145748', 'test_ping_migration_sql'],
  ['20260516191414', 'close_20260204_drift'],
  ['20260517212539', 'recompute_respects_status'],
  ['20260517212545', 'sync_memberships_with_status'],
  ['20260517212645', 'grant_authenticated_private_rls_helpers'],
  ['20260517212720', 'fix_sync_memberships_on_conflict_columns'],
  ['20260518081605', 'p1_ix_agreements_company_id_location_id'],
  ['20260518081608', 'p1_ix_profiles_company_id_location_id'],
  ['20260518081609', 'p1_ix_orders_company_id_location_id'],
  ['20260518081610', 'p1_ix_order_items_product_id'],
  ['20260518081611', 'p1_ix_day_choices_location_id'],
  ['20260518081621', 'p1_ix_location_memberships_company_id_location_id'],
  ['20260518081623', 'p1_ix_location_memberships_user_id_company_id'],
  ['20260518081626', 'p1_ix_orders_agreement_id_company_id_location_id'],
  ['20260518081628', 'p1_ix_deliveries_company_id_location_id'],
  ['20260518094806', 'b2b1_skip_updated_at_only_updates'],
  ['20260518112233', 'b2b2_strip_art9_health_data_order_items'],
  ['20260518122749', 'b2b3_per_table_pii_strip'],
  ['20260518125753', 'b2c_partition_audit_log'],
  ['20260518152838', 'b2c_auto_partition_cron'],
  ['20260520103602', 'patch_2_2_billing_products_minimal'],
  ['20260520110148', 'provider_core_schema'],
  ['20260520110152', 'provider_core_rls_baseline'],
  ['20260520110841', 'provider_id_on_existing_tables'],
  ['20260520110925', 'seed_default_provider_melhus'],
  ['20260520111707', 'provider_rls_helpers'],
  ['20260520111711', 'provider_rls_core_policies'],
  ['20260520112826', 'lifecycle_audit_log_insert_policy'],
  ['20260520112834', 'suspend_rpc_private_helpers'],
  ['20260520112841', 'suspend_rpc_public_provider'],
  ['20260520112849', 'suspend_rpc_public_company'],
  ['20260520112851', 'suspend_rpc_public_user'],
  ['20260520125103', 'lp_order_advance_status_rpc'],
  ['20260520133449', 'company_registrations_provider_intake'],
  ['20260520133500', 'provider_match_postal_code'],
  ['20260520133506', 'provider_registration_rpc_create'],
  ['20260520133509', 'provider_registration_rpc_assert'],
  ['20260520133520', 'provider_registration_rpc_reject'],
  ['20260520133530', 'patch13_provider_registration_rpc_approve'],
  ['20260520134931', 'provider_service_areas_admin'],
  ['20260520134937', 'patch14_lp_service_area_save'],
  ['20260520134938', 'patch14_lp_service_area_toggle'],
  ['20260520140320', 'provider_subscriptions_tables'],
  ['20260520140323', 'provider_subscriptions_rls'],
  ['20260520140327', 'patch15_lp_provider_set_subscription'],
  ['20260520140328', 'patch15_lp_provider_update_billing_contact'],
  ['20260520140330', 'patch15_lp_provider_generate_invoice'],
  ['20260520171234', 'billing_products_enterprise'],
  ['20260520191516', 'tpt0_step6_10_invoice_periods_tripletex_exports'],
  ['20260520191531', 'tpt0_tripletex_customers_repair'],
  ['20260520194833', 'tpt_a2_tripletex_customers_provider_scope'],
  ['20260520194839', 'tpt_a2_lp_provider_create_rpc_fn'],
  ['20260521002726', 'tpt_a5_cron_saas_invoice_service_role'],
  ['20260521004139', 'tpt_a6_webhook_events'],
  ['20260521010002', 'tpt_a7_admin_ui'],
  ['20260521010256', 'tpt_a7_admin_ui_entity_id_fix'],
  ['20260521011943', 'tpt_b1_provider_credentials'],
  ['20260521081644', '20260529120000_tpt_b2_flow_b_mapping'],
  ['20260521085747', '20260530120000_tpt_b3_agreement_invoices'],
  ['20260521085844', '20260530120001_tpt_b3_agreement_invoice_rpcs'],
  ['20260521095433', 'tpt_b5_billing_scheduler'],
  ['20260521104341', 'tpt_b6_webhook_paid_status_schema'],
  ['20260521104349', 'tpt_b6_webhook_paid_status_rpcs'],
  ['20260521131620', 'tpt_b5b_agreement_lifecycle_hooks'],
  ['20260521134921', '20260603120000_tpt_b7_foundation'],
  ['20260521204434', 'tpt_b7_hotfix_guard_order'],
  ['20260522000304', 'tpt_b7_hotfix5_verify_audit_diag'],
  ['20260522010736', 'tpt_b7_hotfix6_outbox_grants'],
  ['20260522041350', 'tpt_b7_hotfix8_service_role_grants'],
  ['20260522104933', 'tpt_b7_polish5_companies_billing_profile'],
  ['20260522140728', 'tpt_b7_polish9_webhook_subscriptions'],
  ['20260522195448', 'k1_outbox_claim_event_kind_filter'],
  ['20260522201310', '20260522160000_k4_kill_esg_tables'],
  ['20260523150430', 'dc018_enable_rls_billing'],
  ['20260523151652', 'dc019_enable_rls_tenant_tables'],
];

const normalize = (name) =>
  name
    .replace(/^20260514181500_/, '')
    .replace(/^20260603120000_/, '')
    .replace(/^20260522160000_/, '')
    .replace(/^20260522161000_/, '')
    .replace(/_schema$/, '')
    .replace(/_rpcs$/, '');

const stagingNames = new Set(staging.map(([, n]) => n));
const prodNames = new Set(prod.map(([, n]) => n));

const prodOnly = [...prodNames].filter((n) => !stagingNames.has(n));
const stagingOnly = [...stagingNames].filter((n) => !prodNames.has(n));

const migDir = path.join(process.cwd(), 'supabase/migrations');
const repoFiles = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql'));

function findRepoFile(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return repoFiles.find((f) => f.toLowerCase().includes(slug.slice(0, 20))) || null;
}

const k6Keywords =
  /profile|membership|agreement|order|day_choice|kitchen|company_current|lp_order|tier_per_day|grant_authenticated|sync_membership/i;

console.log(JSON.stringify({
  stagingCount: staging.length,
  prodCount: prod.length,
  repoCount: repoFiles.length,
  prodOnlyCount: prodOnly.length,
  stagingOnlyCount: stagingOnly.length,
  prodOnly,
  stagingOnly,
  prodOnlyK6: prodOnly.filter((n) => k6Keywords.test(n)),
  prodOnlyK6WithRepo: prodOnly
    .filter((n) => k6Keywords.test(n))
    .map((n) => ({ name: n, repoGuess: findRepoFile(n) })),
}, null, 2));
