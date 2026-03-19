# Database cleanup report

**Scope:** `supabase/migrations/**`  
**Purpose:** Document unused schema elements, cleanup candidates, and migration complexity.  
**Rule:** No deletions; report only.

---

## 1. Unused schema elements (candidates for future cleanup)

### 1.1 Tables with no direct application reference

| Table | Migration(s) | Notes |
|-------|--------------|--------|
| `company_registrations` | 20260220_registration_step1.sql | No `.from("company_registrations")` in app/lib. Used indirectly via RPC `lp_company_register` (insert/update). Candidate for verification before any cleanup. |

### 1.2 RPCs called from application but not defined in migrations

These are invoked in app/lib but have **no** `create or replace function` in the reviewed migrations. They may exist in another environment, be created manually, or be legacy references.

| RPC | Call site(s) |
|-----|----------------|
| `esg_lock_monthly` | app/api/cron/esg/lock/monthly/route.ts |
| `esg_build_daily` | app/api/cron/esg/daily/route.ts |
| `superadmin_assign_profile_to_company` | app/api/superadmin/profiles/assign/route.ts |

**Recommendation:** Confirm whether these RPCs exist in the target database or in another migration source; add migrations if they are required.

### 1.3 Application references to tables/views not created in migrations

The codebase references the following as Supabase tables/views; **no matching `CREATE TABLE` or `CREATE VIEW`** was found in `supabase/migrations/**`. They may be views, materialized views, or defined elsewhere.

| Name | Referenced in |
|------|----------------|
| `esg_monthly_snapshots` | app/api/superadmin/esg/summary/route.ts, app/api/admin/esg/summary/route.ts, app/api/admin/esg/report/executive/pdf/route.ts |
| `esg_yearly_snapshots` | app/api/admin/esg/report/executive/pdf/route.ts |
| `company_agreements` | app/api/superadmin/agreements/[agreementId]/pause/route.ts, app/api/superadmin/agreements/[agreementId]/activate/route.ts, app/api/superadmin/companies/[companyId]/agreement/status/route.ts |
| `employee_audit` | app/api/admin/employees/audit/route.ts, app/api/admin/employees/resend-invite/route.ts |
| `company_invites` | app/api/admin/invites/revoke/route.ts |
| `kitchen_batches` / `BATCH_TABLE` | app/api/kitchen/companies/route.ts, app/api/driver/bulk-set/route.ts |
| `break_glass_sessions` | lib/superadmin/breakGlass.ts, lib/superadmin/rootMode.ts |
| `company_billing_accounts` | lib/auth/scope.ts |
| `profile_company_status` | lib/guards/assertCompanyActive.ts |
| `company_current_agreement` | lib/auth/scope.ts, lib/superadmin/queries.ts, lib/agreement/currentAgreement.ts, lib/pricing/priceForDate.ts |
| `v_company_current_agreement_daymap` | lib/agreement/currentAgreement.ts |
| `deliveries` | lib/superadmin/queries.ts |
| `quality_reports` | lib/superadmin/queries.ts |
| `audit_log` | lib/superadmin/queries.ts |
| `audit_meta_events` | app/api/superadmin/companies/[companyId]/agreement/status/route.ts |
| `audit_rows` | lib/audit/auditWrite.ts |
| `forecast_daily` | lib/superadmin/queries.ts |
| `waste_signals` | lib/superadmin/queries.ts |
| `cron_runs` | lib/superadmin/queries.ts, lib/observability/sli.ts |
| `system_settings` | lib/system/settings.ts |
| `order_outbox` | lib/outbox/orderBackup.ts |

**Recommendation:** Treat as schema drift or external definitions. Align migrations with actual DB objects or document these as legacy/planned objects before any cleanup.

---

## 2. Duplicated or divergent enums

### 2.1 `agreement_status`

- **20260201000000_legacy_bootstrap_minimal.sql:** `PENDING`, `ACTIVE`, `PAUSED`, `CLOSED`
- **20260218_enterprise_registration_agreement_order_guards.sql:** `PENDING`, `ACTIVE`, `TERMINATED` (create with `duplicate_object` handling)
- **20260218_step1_4_schema_safe_hardening.sql:** Assumes `TERMINATED` exists (e.g. fail-closed check)
- **20260220_agreement_step2.sql:** `alter type public.agreement_status add value if not exists 'TERMINATED'`

**Observation:** Bootstrap and guards define different value sets. Later migrations add `TERMINATED`. Final enum can end up with both `PAUSED`/`CLOSED` and `TERMINATED`. Document intended canonical set and consider consolidating in a single migration for clarity.

### 2.2 `order_status`

- **20260201000000_legacy_bootstrap_minimal.sql:** `ACTIVE`, `CANCELED` (US spelling)
- **20260218_enterprise_registration_agreement_order_guards.sql:** Adds `CANCELLED` (UK) via `add value if not exists`; or creates enum `ACTIVE`, `CANCELLED`, `CANCELED`

**Observation:** Two spellings exist. Application code uses both (e.g. `status === "CANCELLED"` and `status === "CANCELED"`). Document which is canonical and whether the other is kept for compatibility only.

### 2.3 Other enums

- `user_role`, `company_status`, `agreement_tier`: Created in legacy bootstrap and re-created in guards with `duplicate_object` handling. No value conflicts observed; duplication is for idempotency.

---

## 3. Tables with multiple migration definitions (complexity hotspots)

### 3.1 `content_pages` / `content_page_variants`

- **20260229000000_content_workflow_state.sql:** Minimal shells (id only for pages; id + page_id for variants).
- **20260228000000_content_analytics_events.sql:** Same minimal shells.
- **20260304000000_content_releases.sql:** Same minimal shells + `content_releases`, `content_release_items`.
- **20260317000001_create_content_pages_tables.sql:** Full table definitions (title, slug, status, body, locale, environment, etc.).

**Observation:** Several migrations create minimal `content_pages`/`content_page_variants` for FKs; one migration defines the full schema. Order of application matters. Hotspot for understanding content CMS schema evolution.

### 3.2 `esg_monthly`

- **20260218_task8_10_esg_monthly_indices.sql:** `month date`, columns e.g. `delivered_meals`, `canceled_meals`, `waste_estimate_kg`, `co2_estimate_kg`.
- **20260218_orders_rollup_invoice_esg_overview.sql:** `esg_monthly` again with `month date`, different column names (e.g. `delivered_meals`, `canceled_meals`), plus `lp_rollup_rebuild_for_date` populating it.
- **20260221_step6_10_fasit_periods_esg.sql:** Conditional create; if not exists: `month text` (YYYY-MM), columns `delivered_count`, `cancelled_count`, `delivery_rate`, `waste_estimate_kg`, `co2_estimate_kg`, `generated_at`. If exists: only validates `month` type is text.

**Observation:** Column names and types differ (e.g. `month` date vs text; `delivered_meals` vs `delivered_count`). Migration order will determine final shape. High complexity; document target schema and consolidate in a single source of truth if possible.

### 3.3 `invoice_lines` / `invoice_exports`

- **20260218_norwegian_standard_billing.sql:** Defines `billing_tax_codes`, `billing_products`, `invoice_lines`, `invoice_exports`, `tripletex_customers`.
- **20260218_orders_rollup_invoice_esg_overview.sql:** Also creates `invoice_lines` and `invoice_exports` (partitioning/rollup context).
- **20260218_invoice_lines_generator_point7.sql:** Creates `invoice_lines` (dynamic).

**Observation:** Multiple migrations define or alter the same tables. Risk of conflicting columns or constraints; document intended final structure and dependency order.

### 3.4 `ai_activity_log`

- **20260305000000_ai_activity_log.sql:** Full table + RLS.
- **20260306000000_ai_activity_log.sql:** No-op (superseded comment).
- **20260307000000_ai_activity_log_reconcile.sql:** Reconcile / alter logic.

**Observation:** Multiple files touch the same table; harmless but worth a single place for “current shape” documentation.

---

## 4. Unused RPC functions (defined in migrations, not called in app)

RPCs that exist in migrations but were **not** found as `.rpc("...")` in app/lib/tests (excluding tests that mock by name):

| RPC | Migration(s) | Notes |
|-----|--------------|--------|
| `lp_ensure_orders_partition` | 20260218_orders_rollup_invoice_esg_overview.sql | Used only inside same migration (e.g. by other functions). Not called from app. |
| `lp_rollup_rebuild_for_date` | 20260218_orders_rollup_invoice_esg_overview.sql | Same; invoked from migration logic, not from application code. |
| `lp_touch_company_registrations_updated_at` | 20260220_registration_step1.sql | Trigger only. |
| `lp_touch_employee_invites_updated_at` | 20260219_employee_invites.sql | Trigger only. |
| `forms_updated_at` | 20260305000000_forms_and_submissions.sql | Trigger only. |
| `lp_orders_outbox_trigger` | 20260217_enterprise_outbox_worker_rpc.sql | Trigger only. |

**Note:** Trigger-only or migration-internal RPCs are not “unused” from a DB perspective; they are part of the schema. They are listed here only to clarify “not called from application code.” No recommendation to drop.

---

## 5. Migration complexity hotspots (summary)

| Area | Issue |
|------|--------|
| **Enums** | `agreement_status` and `order_status` have multiple definitions or added values across migrations; US/UK spelling and PAUSED/CLOSED vs TERMINATED. |
| **content_pages / content_page_variants** | Minimal shells in several migrations; full schema in one; order-sensitive. |
| **esg_monthly** | Three different shapes (date vs text month; different column names); conditional creation and validation. |
| **invoice_lines / invoice_exports** | Defined or altered in multiple migrations; dynamic creation in one. |
| **RPC duplication** | `lp_company_register`, `lp_agreement_create_pending`, `lp_agreement_approve`, `lp_order_set` appear in more than one migration (e.g. step1_4, agreement_step2, enterprise_registration, orders_rollup). Later migrations replace earlier definitions; traceability is non-trivial. |
| **Tables referenced in code only** | Many names (e.g. `company_agreements`, `esg_monthly_snapshots`, `break_glass_sessions`, `cron_runs`) are used in app/lib but not created in migrations—schema drift or external definitions. |

---

## 6. Tables and RPCs usage summary (from migrations vs app)

### 6.1 Tables created in migrations and referenced in app/lib

Used in application or scripts:  
`companies`, `company_locations`, `profiles`, `agreements`, `orders`, `outbox`, `idempotency`, `content_pages`, `content_page_variants`, `content_releases`, `content_workflow_state`, `content_audit_log`, `content_health`, `content_analytics_events`, `media_items`, `forms`, `form_submissions`, `audit_events`, `ai_activity_log`, `ai_suggestions`, `ai_jobs`, `experiment_results`, `entities`, `entity_relations`, `enterprise_groups`, `incidents`, `system_health_snapshots`, `system_incidents`, `repair_jobs`, `ops_events`, `employee_invites`, `esg_monthly`, `daily_company_rollup`, `daily_employee_orders`, `invoice_periods`, `invoice_lines`, `invoice_exports`, `billing_tax_codes`, `billing_products`, `tripletex_customers`, `tripletex_exports`, `company_deletions`.

### 6.2 RPCs defined in migrations and called from app

- `lp_company_register` – onboarding/register
- `lp_agreement_create_pending`, `lp_agreement_approve_active` – superadmin agreements
- `lp_order_set` – orders/set, orders/route, lib/orders/rpcWrite.ts
- `lp_outbox_claim`, `lp_outbox_mark_sent`, `lp_outbox_mark_failed`, `lp_outbox_reset_stale` – outbox processing (lib/orderBackup/outbox.ts, tests)
- `claim_ai_jobs` – lib/ai/jobs/claim.ts
- `claim_repair_jobs` – superadmin/system/repairs/run

---

## 7. Recommendations (non-destructive)

1. **Enum consolidation:** Document and, in a future migration, establish a single canonical definition for `agreement_status` and `order_status` (including spelling), and add a comment in migrations.
2. **esg_monthly:** Document the intended final column set and type of `month`; consider one migration that creates or alters to that shape and deprecate divergent branches.
3. **Missing RPCs:** Add migrations for `esg_lock_monthly`, `esg_build_daily`, and `superadmin_assign_profile_to_company` if they are required in production, or remove/guard the call sites if not.
4. **Referenced-but-undefined objects:** Produce a list of tables/views the app expects (e.g. `company_agreements`, `esg_monthly_snapshots`, `break_glass_sessions`, `cron_runs`) and either add migrations or document them as external/legacy.
5. **Content CMS and billing:** Keep a short “schema truth” doc that states which migration is authoritative for `content_pages`/`content_page_variants` and for `invoice_lines`/`invoice_exports` given the current order.

---

*Report generated from review of `supabase/migrations/**` and codebase references. No schema changes or deletions were made.*
