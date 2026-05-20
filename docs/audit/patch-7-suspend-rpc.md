# Patch 7 — suspend/pause/delete RPC + audit cascade (Phase E.7)

**Date:** 2026-05-20  
**Refs:** PROVIDER-PLAN-V1 §6 · Patch 6 (`0aaf62d6`)

## Discovery (pre-migration)

### RPC pattern (`lp_agreement_approve_active`, `lp_company_register`)

- `SECURITY DEFINER`, `SET search_path = public` (or `public, pg_catalog`)
- Errors via `RAISE EXCEPTION ... USING ERRCODE = '...'` — e.g. `P0001`, `P0002`, `23505`
- Patch 7 lifecycle RPCs use: `22023` (reason), `42501` (permission), `02000` (not found)

### `lifecycle_audit_log` (Patch 4)

| Column | Type |
|--------|------|
| id | uuid PK |
| actor_id | uuid → profiles |
| action, entity_type | text |
| entity_id | uuid |
| reason | text |
| metadata | jsonb |
| created_at | timestamptz |

Pre-Patch 7 policies: `lifecycle_audit_log_superadmin_select` (SELECT only). No INSERT/UPDATE/DELETE.

### `order_status` enum (staging/prod)

`DRAFT`, `SUBMITTED`, `LOCKED`, `PREPARED`, `DISPATCHED`, `DELIVERED`, `ACTIVE`, `CANCELLED` — **no `PAUSED`** before Patch 7.

`guard_order_mutation` / `assert_order_mutable` blocks updates when status ∈ `LOCKED`, `PREPARED`, `DISPATCHED`, `DELIVERED`, `CANCELLED`, or cutoff passed. Cascade uses `DISABLE TRIGGER guard_order_mutation` for one-time backfill-style updates.

**Patch 7 adds:** `ALTER TYPE order_status ADD VALUE 'PAUSED'` (migration `20260520180000`, separate TX).

## Migrations (repo)

| File | Content |
|------|---------|
| `20260520180000_lifecycle_audit_log_insert_policy.sql` | `order_status.PAUSED` + INSERT policy |
| `20260520180001_suspend_rpc_private_helpers.sql` | Private helpers (audit, orders cascade, RBAC asserts) |
| `20260520180002_suspend_rpc_public_functions.sql` | 12 public RPCs + GRANT + verify |

## 12 public RPCs

| RPC | RBAC |
|-----|------|
| `lp_provider_{suspend,pause,delete,resume}` | `is_platform_admin()` only |
| `lp_company_{suspend,pause,delete,resume}` | `can_access_provider(company.provider_id)` or platform admin |
| `lp_user_{suspend,pause,delete,resume}` | `can_admin_company` / `can_access_provider` / platform admin |

Suspend/delete require reason ≥ 20 chars (`22023`). Idempotent `already_*` jsonb flags.

## Apply (MCP)

| Step | Staging | Prod |
|------|---------|------|
| lifecycle_audit_log_insert_policy | OK | OK |
| suspend_rpc_private_helpers | OK | OK |
| suspend_rpc_public_provider | OK | OK |
| suspend_rpc_public_company | OK | OK |
| suspend_rpc_public_user (+ grants) | OK | OK |

Verify:

```sql
SELECT proname, prosecdef FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN ('lp_company_suspend','lp_provider_suspend','lp_user_suspend');
-- prosecdef = true for all 12 lifecycle RPCs

SELECT policyname FROM pg_policies WHERE tablename = 'lifecycle_audit_log';
-- lifecycle_audit_log_insert_via_rpc, lifecycle_audit_log_superadmin_select
```

## TypeScript / tests

- `lib/admin/suspend.ts` — server wrappers via `supabaseServer()`, `SuspendError`
- `tests/db/suspend-rpc.test.ts` — opt-in integration (`RUN_SUPABASE_INTEGRATION_TESTS=1`)

```bash
RUN_SUPABASE_INTEGRATION_TESTS=1 npx vitest run tests/db/suspend-rpc.test.ts --poolOptions.forks.maxForks=1
```

## Not in scope

- UI routes (Patch 9–10)
- Auth TypeScript helpers (Patch 8)
- Suspend-aware SELECT RLS (Patch 7 follow-up in plan §7.4)

## Next

**Patch 8** — Provider Admin auth & helpers (TypeScript-side).
