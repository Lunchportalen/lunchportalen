# TPT-B-7-foundation — Audit

**Patch:** TPT-B-7-foundation  
**Plan:** TRIPLETEX-PLAN-V1 v3.14  
**Date:** 2026-05-21  
**Status:** ✅ COMPLETED  
**Arch-doc:** `docs/architecture/tripletex-onboarding-strategy.md`

---

## Schema diff (`provider_tripletex_credentials`)

| Column | Type | Purpose |
|---|---|---|
| `connection_state` | `text` CHECK (5 states) | State machine (default `NOT_CONNECTED`) |
| `state_changed_at` | `timestamptz` | Last transition timestamp |
| `disconnected_at` | `timestamptz` | Soft-disconnect start |
| `vault_purge_at` | `timestamptz` | `disconnected_at + 30d` |
| `health_check_at` | `timestamptz` | Last successful `/v2/whoAmI` |
| `onboarding_provisioning_complete_at` | `timestamptz` | Worker completion marker |
| `cached_tripletex_company_name` | `text` | Dashboard display name |

**Indexes:** `idx_provider_tripletex_credentials_purge`, `idx_provider_tripletex_credentials_health`

**Migrations:**
- `20260603120000_tpt_b7_foundation.sql`
- `20260603120100_tpt_b7_foundation_fix.sql` (elevated-caller + read guard + RPC auth)

---

## State machine

Implemented in `private.lp_tripletex_transition_connection_state` with `private.lp_tripletex_allowed_transition`.

Audit events written to `lifecycle_audit_log` (`entity_type = tripletex_connection`) in same transaction as transitions.

**Backfill:** rows with `employee_token_secret_id IS NOT NULL` → `CONNECTED`.  
Staging/prod at apply time: **0 credential rows** (empty table — backfill no-op, expected).

---

## RPC design — HTTP verification strategy

**Decision: Node-side HTTP, not pg_net.**

| RPC | HTTP | Notes |
|---|---|---|
| `lp_provider_test_tripletex_token` | **Node** (`onboardingVerify.ts`) | RPC records trusted `p_verification_result` via `service_role` or superadmin |
| `lp_provider_complete_tripletex_connection` | **Node** re-verify + RPC persist | Requires validated result + `p_consumer_token` from env |
| Others | N/A | Pure DB / state |

**Flow (B-7b):**
1. API route validates `provider_admin` session
2. `verifyTripletexEmployeeToken()` → Tripletex `/whoAmI` + `/product?count=1`
3. `service_role` calls RPC with verification JSON (never returns tokens)

**Tripletex client additions:**
- `createTripletexAuthFromTokens()`
- `tripletexWhoAmI()`
- `tripletexVerifyProductAccess()`

---

## Worker + outbox

- `lib/integrations/tripletex/onboardingSync.ts` → `handleOnboardingProvisioningStart`
- Event prefix: `tripletex.onboarding_provisioning_start:{provider_id}:{env}`
- Wired in `app/api/system/outbox/process/route.ts`

---

## Cron

- `GET/POST /api/cron/tripletex-connection-health-daily`
- Schedule: `0 5 * * *` UTC (`vercel.json`)
- Uses `lp_provider_apply_connection_health_check` + `lp_provider_purge_disconnected_vault`

---

## CSS tokens

Added to **`app/styles/ds/design-system.css`** (Next.js app shell — not Umbraco `wwwroot`).

Classes: `.ds-wizard*`, `.ds-verify-*`, `.ds-status-badge--*`, `.ds-secret-*`, `@keyframes ds-pulse`, mobile-first breakpoints, `prefers-reduced-motion` overrides.

---

## Tests

9 files, **34 cases** (all PASS with `RUN_SUPABASE_INTEGRATION_TESTS=1` for DB tests):

- 7 RPC integration test files
- `onboardingProvisioningStart.test.ts` (4)
- `cron-tripletex-connection-health-daily.test.ts` (5)

---

## Security notes

- `private.lp_is_elevated_caller()` uses **`auth.role()` only** (not `current_user` — unsafe inside SECURITY DEFINER)
- Read health: `can_access_provider()` (any provider membership)
- Mutations: `lp_assert_provider_admin_or_superadmin`
- Provisioning complete: `service_role` only

---

## Next

- **TPT-B-7b:** Direct wizard UI (primary)
- **TPT-B-7a:** Marketplace redirect (parallel)
- **TPT-B-7c:** Connection health dashboard
