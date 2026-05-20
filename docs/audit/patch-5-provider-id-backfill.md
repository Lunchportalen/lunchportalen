# Patch 5 — provider_id on existing tables + Melhus default (Phase E.5)

**Date:** 2026-05-20  
**Refs:** PROVIDER-PLAN-V1 §4.3, §10.2 · Patch 4 (`effc51ec`)

## Scope

- `20260520160000_provider_id_on_existing_tables.sql` — nullable columns + indexes
- `20260520160001_seed_default_provider_melhus.sql` — Melhus seed, backfill, NOT NULL (except `company_registrations`)

**Not in scope:** `can_access_provider()`, provider RLS on tenant tables (Patch 6), UI, cascade RPCs (Patch 7).

## Discovery (pre-migration)

| Table | Staging exists | Prod exists | Staging rows | Prod rows | `provider_id` pre-patch |
|-------|----------------|-------------|--------------|-----------|-------------------------|
| companies | yes | yes | 0 | 9 | none |
| agreements | yes | yes | 0 | 5 | none |
| orders | yes | yes | 0 | 5 | none |
| company_registrations | yes | yes | 0 | 2 | none |
| menu_service_days | yes | yes | 0 | 25 | none |
| profiles | yes | yes | 0 | 19 | n/a (lifecycle cols only) |

**Projects:** staging `uigxsboqeruxflgzqztl`, prod `hkpokyapzarefrgqzkos`.

## Default provider

| Field | Value |
|-------|--------|
| UUID | `11111111-1111-1111-1111-111111111111` |
| Name | Melhus Catering AS |
| Slug | `melhus-catering` |
| Status | ACTIVE |
| Service area | Trondheim, NO, postal 7000–7099, min 20 employees |

`contact_email` is a placeholder until Melhus confirms details.

## Apply order

1. Staging: `provider_id_on_existing_tables` → `seed_default_provider_melhus` — **OK**
2. Prod: `provider_id_on_existing_tables` — **OK**
3. Prod: `seed_default_provider_melhus` — **first attempt FAILED**, **retry OK**

### Prod seed failure (resolved)

**Error:** `Order is locked and cannot be changed` from `assert_order_mutable()` via `guard_order_mutation` on `UPDATE orders`.

**Cause:** Prod orders include `CANCELLED` and cutoff-passed rows; trigger blocks any UPDATE without platform role.

**Fix:** Migration disables `guard_order_mutation` only for the one-time `provider_id` backfill, then re-enables. No runtime trigger semantics changed.

**Expected backfill (prod):** companies 9, agreements 5, orders 5, company_registrations 2, menu_service_days 25.

**Staging backfill:** all 0 (empty branch).

## Post-migration verification

### Prod

```text
Melhus: id=11111111-..., slug=melhus-catering, status=ACTIVE
NULL counts: companies/agreements/orders/menu_service_days = 0
is_nullable: companies/agreements/orders/menu_service_days = NO; company_registrations = YES
companies with non-Melhus provider_id: 0
```

### Staging

Same NOT NULL pattern on operational tables; row counts remain 0; Melhus row present.

## Columns added

**companies:** `provider_id`, `logo_url`, suspend/pause/delete lifecycle fields  
**agreements / orders / menu_service_days:** `provider_id` (NOT NULL after backfill)  
**company_registrations:** `provider_id` (nullable), `requested_postal_code`, `requested_city`  
**profiles:** `suspended_at`, `suspended_by`, `suspended_reason`, `paused_at`, `deleted_at`

Indexes: `idx_companies_provider`, `idx_agreements_provider`, `idx_orders_provider`, `idx_company_registrations_provider`, `idx_menu_service_days_provider` (menu index only if table exists).

## Next

**Patch 6:** `can_access_provider()` + provider-scoped RLS on existing tables.
