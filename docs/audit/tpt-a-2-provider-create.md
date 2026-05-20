# TPT-A-2: lp_provider_create + outbox enqueue

**Date:** 2026-05-20  
**Migration:** `supabase/migrations/20260522120000_tpt_a2_lp_provider_create.sql`  
**References:** TRIPLETEX-PLAN-V1 v3.1 §4 Sekvens A1 + §5 TPT-A-2, TPT-A-1 `9bfde463`

## FASE 0 — Scope (entydig)

| Item | In scope TPT-A-2 | Deferred |
|------|------------------|----------|
| `lp_provider_create` RPC | Yes | — |
| `lifecycle_audit_log` | Yes (`provider_created`) | — |
| Outbox enqueue | Yes | — |
| `tripletex_customers.provider_id` + CHECK | Yes | — |
| Worker / Tripletex POST | **No** | TPT-A-3 |
| Superadmin UI | **No** | Later |

**event_key:** `tripletex.provider_customer_create_lp:<provider_id>`

## RPC signature

```sql
public.lp_provider_create(
  p_slug text,
  p_name text,
  p_contact_email text,
  p_org_number text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_billing_org_no text DEFAULT NULL,
  p_billing_email text DEFAULT NULL,
  p_billing_address text DEFAULT NULL,
  p_default_tier_pricing text DEFAULT NULL,
  p_billing_model text DEFAULT 'SAAS_FIXED',
  p_request_rid text DEFAULT NULL
) RETURNS jsonb
```

- **Guard:** `public.is_platform_admin()` → else `PERMISSION_DENIED`
- **Returns:** `{ ok, provider_id, event_key, request_rid }`
- **Pattern:** Patch 7 (`SECURITY DEFINER`, `private.lp_lifecycle_audit`)

## Audit-log contract

| Field | Value |
|-------|--------|
| `action` | `provider_created` |
| `entity_type` | `provider` |
| `entity_id` | new `providers.id` |
| `metadata` | `slug`, `name`, `contact_email`, `org_number`, `billing_model`, optional `billing_address`, `default_tier_pricing` |

## Outbox event contract

| Field | Value |
|-------|--------|
| `event_key` | `tripletex.provider_customer_create_lp:<provider_id>` |
| `payload` | `{ provider_id, target: 'lp', request_rid }` |
| `status` | `PENDING` |
| Dedup | `ON CONFLICT (event_key) DO NOTHING` |

**TPT-A-3:** Worker dispatches prefix `tripletex.provider_customer_create_lp`, calls `resolveTripletexAuth()` (Lp), creates Tripletex Customer, inserts `tripletex_customers` row with `provider_id` set, `company_id` null.

## Schema change

- `tripletex_customers.provider_id` uuid NULL → `providers(id)` ON DELETE CASCADE
- `company_id` nullable (was NOT NULL on baseline)
- `tripletex_customers_scope_check`: XOR company vs provider scope
- Unique partial index on `provider_id` WHERE NOT NULL

## MCP apply (staging + prod)

| Step | Staging `uigxsboqeruxflgzqztl` | Prod `hkpokyapzarefrgqzkos` |
|------|-------------------------------|----------------------------|
| Schema migration | OK | OK |
| RPC function | OK | OK |
| `GRANT EXECUTE` (11× text sig) | OK | OK |

Repo file is single migration; live apply used split MCP steps (MCP payload / grant signature).

## Test coverage

File: `tests/db/lp_provider_create.test.ts` (opt-in: `RUN_SUPABASE_INTEGRATION_TESTS=1` + staging Postgres URL)

| Case | Status |
|------|--------|
| Superadmin create + audit + outbox | Written (skipped locally — no staging `SUPABASE_POSTGRES_URL`) |
| Duplicate slug | Written |
| Missing name | Written |
| Employee / provider_admin denied | Written |
| CHECK both scopes fails | Written |
| Provider-only `tripletex_customers` insert | Written |

## Anomalies

1. **GRANT:** Function has 11 parameters; grant must use 11× `text` (not 12).
2. **Integration tests:** Skipped in CI/local without staging Postgres fixture env (same as other `tests/db/*` opt-in).

## Next step

**TPT-A-3** — outbox worker handler + Tripletex Customer create for Flow A (not started).
