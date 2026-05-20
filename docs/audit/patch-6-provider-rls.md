# Patch 6 — can_access_provider + provider RLS (Phase E.6)

**Date:** 2026-05-20  
**Refs:** PROVIDER-PLAN-V1 §7 · Patch 5 (`eebc1bd3`)

## Discovery (pre-migration)

### Helper patterns (staging)

**`public.can_access_company(company_uuid uuid)`** — SQL, STABLE, SECURITY DEFINER, `search_path = public`:

- `is_superadmin()` OR `is_ops()`
- OR active `company_memberships` / `location_memberships` / `profiles` for `auth.uid()`

**`public.is_platform_admin()`** — plpgsql, STABLE, SECURITY DEFINER, `search_path = public`:

- `is_superadmin()` OR `is_ops()` OR optional `is_platform_admin_legacy()`

**`private.can_access_company`** (used in `companies_select`) — separate private helper with platform roles + `company_memberships.status = 'active'`.

Patch 6 adds **`public.can_access_provider`** mirroring the public bridge style (membership + `is_platform_admin()`).

### Existing policies (staging, pre-Patch 6)

| Table | Policies |
|-------|----------|
| providers | `providers_superadmin_all` (ALL) |
| provider_memberships | `provider_memberships_superadmin_all` (ALL) |
| companies | `companies_insert`, `companies_select`, `companies_update`, `companies_write_superadmin` |
| agreements | `agreements_*_scoped` (4) |
| orders | `orders_select`, `orders_select_bridge_scoped`, `orders_insert`, `orders_update`, `orders_delete` |
| menu_service_days | `menu_service_days_select`, `menu_service_days_manage` |
| company_registrations | `company_registrations_superadmin`, `company_registrations_service_role_full` |

**Additive rule:** none of the above were dropped or altered.

### RLS test pattern

- `tests/_helpers/rlsFixtures.ts` — service role setup, `createAccessToken`, `supabaseAs(token)`
- `tests/rls/tenantIsolation.final.test.ts` — integration against remote Supabase when `RUN_SUPABASE_INTEGRATION_TESTS=1`
- Patch 6: `tests/db/provider-rls.test.ts` (same opt-in)

**Fixture note:** `rlsFixtures` now sets `provider_id = Melhus` on company/order/agreement inserts (required post Patch 5 NOT NULL).

## Migrations

| File | Purpose |
|------|---------|
| `20260520170000_provider_rls_helpers.sql` | `can_access_provider(uuid)` + GRANT + SECURITY DEFINER check |
| `20260520170001_provider_rls_core_policies.sql` | 14 parallel provider-scope policies |

## New policies (14)

| Table | Policy | Cmd |
|-------|--------|-----|
| providers | `providers_select_member` | SELECT |
| providers | `providers_update_admin` | UPDATE (provider_admin only) |
| provider_memberships | `provider_memberships_select_admin` | SELECT |
| provider_memberships | `provider_memberships_insert_admin` | INSERT |
| provider_memberships | `provider_memberships_delete_admin` | DELETE |
| companies | `companies_select_provider_scope` | SELECT |
| companies | `companies_update_provider_scope` | UPDATE |
| agreements | `agreements_select_provider_scope` | SELECT |
| agreements | `agreements_update_provider_scope` | UPDATE |
| orders | `orders_select_provider_scope` | SELECT only |
| menu_service_days | `menu_service_days_select_provider_scope` | SELECT |
| menu_service_days | `menu_service_days_update_provider_scope` | UPDATE |
| company_registrations | `company_registrations_select_provider_scope` | SELECT (`provider_id IS NOT NULL`) |
| company_registrations | `company_registrations_update_provider_scope` | UPDATE |

`providers_superadmin_all` / `provider_memberships_superadmin_all` (Patch 4) remain unchanged.

## Apply

| Env | `provider_rls_helpers` | `provider_rls_core_policies` |
|-----|------------------------|------------------------------|
| Staging `uigxsboqeruxflgzqztl` | OK | OK (14 policies) |
| Prod `hkpokyapzarefrgqzkos` | OK | OK (14 policies) |

## Verification

```sql
SELECT proname, prosecdef FROM pg_proc WHERE proname = 'can_access_provider';
-- prosecdef = true

SELECT count(*) FROM pg_policies
WHERE schemaname = 'public'
  AND (policyname LIKE '%_provider_scope'
    OR policyname IN ('providers_select_member','providers_update_admin',
      'provider_memberships_select_admin','provider_memberships_insert_admin',
      'provider_memberships_delete_admin'));
-- 14
```

Run integration tests (staging URL recommended):

```bash
RUN_SUPABASE_INTEGRATION_TESTS=1 npx vitest run tests/db/provider-rls.test.ts --poolOptions.forks.maxForks=1
```

## Not in scope

- UI / auth TypeScript (Patch 8)
- Suspend RPCs / lifecycle_audit_log triggers (Patch 7)
- Suspend-aware SELECT filters (Patch 7)
- Orders UPDATE for provider_admin (cutoff + `guard_order_mutation` unchanged)

## Next

**Patch 7** — suspend/pause/delete RPC + lifecycle_audit_log INSERT triggers.
