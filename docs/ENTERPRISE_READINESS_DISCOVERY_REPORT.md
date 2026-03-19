# ENTERPRISE READINESS DISCOVERY REPORT

**Class:** Enterprise readiness discovery  
**Scope:** Verified map of remaining gaps before hardening (no code changes).  
**Date:** 2026-03-14

---

## 1. Summary

The repository is already strong (~88%): health/status, auth/scope, API contract, fail-closed patterns, tenant isolation tests, and CI gates are in place. The following report isolates **verified** gaps only—no speculative features—and names exact files so hardening can be targeted.

---

## 2. Areas Already Enterprise-Safe (Verified)

### 2.1 Runtime safety

| Area | Evidence | Files |
|------|----------|--------|
| Public health | Returns 503 when DB/sanity/env fail; no fake OK; `validateSystemRuntimeEnv()` used | `app/api/health/route.ts`, `lib/env/system.ts` |
| Health contract | Structured body with `ok`, `rid`, `summary`, `checks`; `jsonErr` on failure | `app/api/health/route.ts`, `lib/http/respond.ts` |
| Env fail-fast | Supabase/Sanity config throws on missing required env in non-test | `lib/config/env.ts` |
| System health runner | `runHealthChecks()` runs runtime, DB, Sanity, timezone; returns report | `lib/system/health.ts`, `lib/system/healthStatus.ts` |

### 2.2 Health / status surfaces

| Surface | Evidence | Files |
|---------|----------|--------|
| Public health | GET `/api/health` — app, supabase, db_schema, sanity, env | `app/api/health/route.ts` |
| Superadmin status | GET `/api/superadmin/system/status` — scopeOr401 + requireRoleOr403(superadmin), `getOperationalStatus()` | `app/api/superadmin/system/status/route.ts`, `lib/observability/statusAggregator.ts` |
| Status page | `/status` — safe state parsing, no redirect to `/login`, fail-closed default `blocked` | `app/status/page.tsx` |
| Operational status | Health checks + SLIs + alerts + open incidents; status normal/degraded/critical | `lib/observability/statusAggregator.ts`, `lib/observability/types.ts` |

### 2.3 Config / env validation

| Item | Evidence | Files |
|------|----------|--------|
| System runtime env | `validateSystemRuntimeEnv()` — only `SYSTEM_MOTOR_SECRET`; never throws; returns `{ ok, missing? }` | `lib/env/system.ts` |
| Supabase/Sanity | `getSupabasePublicConfig()`, `getSupabaseAdminConfig()`, `getSanityReadConfig()` throw in non-test if missing | `lib/config/env.ts` |
| Tests | Env validation tests for missing SYSTEM_MOTOR_SECRET and Supabase/Sanity | `tests/env/envValidation.test.ts` |

### 2.4 Auth / permission fail-closed

| Item | Evidence | Files |
|------|----------|--------|
| Middleware | Bypass for `/api/*`, `/login`, `/status`; protected paths require auth; redirect to `/status` on missing Supabase env | `middleware.ts` |
| Route guard | `scopeOr401`, `requireRoleOr403`, `denyResponse`; denyResponse returns 401 when s is null/undefined | `lib/http/routeGuard.ts` |
| Scope | `getScope`; company active, agreement/billing enforced in getScopeServer | `lib/auth/getScopeServer.ts`, `lib/auth/scope.ts` |
| Require role | `requireRole()` returns 401/403 on auth or profile missing / wrong role | `lib/auth/requireRole.ts` |
| Supabase admin | `supabaseAdmin()` throws on missing config (fail-closed) | `lib/supabase/admin.ts` |
| API routes | Large set of admin/superadmin/kitchen/driver routes use scopeOr401 + requireRoleOr403 | 150+ route files under `app/api/` (grep verified) |

### 2.5 Auditability / logging

| Item | Evidence | Files |
|------|----------|--------|
| Audit write | `writeAudit()` → `audit_log` table; fail-quiet (no throw); console.error on insert failure | `lib/audit/log.ts`, `lib/audit/actions.ts` |
| Ops log | `opsLog(scope, payload)` → JSON to console | `lib/ops/log.ts` |
| RID | All API responses carry `x-rid` and body `rid` | `lib/http/respond.ts` |
| Error detail | `allowDetail()`: only in RC_MODE or non-production; prod hides detail | `lib/http/respond.ts` |

### 2.6 Operational recovery paths

| Item | Evidence | Files |
|------|----------|--------|
| Status page | User-facing `/status` with state=blocked, code=MISSING_SUPABASE_ENV, etc. | `app/status/page.tsx`, `middleware.ts` |
| Health 503 | Load balancers can use GET `/api/health` for unhealthy detection | `app/api/health/route.ts` |
| Docs | HEALTH_CRON_TRUTH, CRON_AUTH, drift/cron-error-handling | `docs/HEALTH_CRON_TRUTH.md`, `docs/CRON_AUTH.md`, `docs/drift/cron-error-handling.md` |

### 2.7 Deployment / build gates

| Gate | Evidence | Files |
|------|----------|--------|
| build:enterprise | agents:check, audit:api, audit:repo, check:admin-copy, next build, seo-proof, seo-audit, seo-content-lint | `package.json` |
| ci:enterprise | Verify required env, typecheck, test:run, test:tenant, lint, audit:api, audit:repo, check:admin-copy, agents:check, build:enterprise | `.github/workflows/ci-enterprise.yml` |
| ci.yml | ci:guard, typecheck, lint, test:run, test:tenant, verify secrets, build:enterprise | `.github/workflows/ci.yml` |
| CI secrets | SYSTEM_MOTOR_SECRET, Supabase, Sanity required in workflow env | Both workflow files |
| ci-guard | Service-role allowlist; orders write scan | `scripts/ci-guard.mjs` |

### 2.8 Test / CI proof

| Area | Evidence | Files |
|------|----------|--------|
| Tenant isolation | test:tenant; company scope asserted in responses | `tests/tenant-isolation.test.ts`, `tests/tenant-isolation-*.test.ts` |
| Health | Public health no fake OK when DB fails | `tests/api/healthPublic.test.ts` |
| Env | validateSystemRuntimeEnv and getSupabasePublicConfig/getSanityReadConfig | `tests/env/envValidation.test.ts` |
| System health | systemHealthAggregator, statusAggregator, health status derivation | `tests/system/systemHealthAggregator.test.ts`, `tests/lib/system-health-status.test.ts`, `tests/lib/observability-statusAggregator.test.ts` |
| Middleware | Redirect safety, no login loop | `tests/middleware/middlewareRedirectSafety.test.ts` |
| Auth/role | adminOrdersRoleGuard, roleIsolationEndpoints, privilegeBoundaries, kitchenDriverScopeGuard | `tests/auth/`, `tests/security/` |
| RLS | domainHardening, orderAgreementRulesGate, companyAdminStatusGate, etc. | `tests/rls/*.test.ts` |

### 2.9 Security-sensitive surfaces

| Item | Evidence | Files |
|------|----------|--------|
| Cron auth | requireCronAuth (Bearer / x-cron-secret); throws on missing/forbidden | `lib/http/cronAuth.ts` |
| Service-role allowlist | Only allowed paths may reference service role key | `scripts/ci-guard.mjs` |
| RLS | Kitchen/driver scope RLS; fail-closed policies | `supabase/migrations/20260216_kitchen_driver_scope_rls.sql`, related migrations |
| Company from server | Admin/superadmin routes use scope (server-derived company_id), not client body for tenant scope | Pattern verified across routeGuard usage |

### 2.10 Single source of truth (no duplicate health logic)

| Item | Evidence | Files |
|------|----------|--------|
| Operational status | Single aggregator: runHealthChecks + SLIs + alerts + incidents | `lib/observability/statusAggregator.ts` |
| Route registry | ROUTE_REGISTRY for proof of guard standard | `lib/system/routeRegistry.ts` |
| API contract | jsonOk/jsonErr, RID, no-store; documented | `lib/http/respond.ts`, `docs/SYSTEM_READINESS_TRUTH.md` |

---

## 3. Verified Partial Areas (Gaps)

### 3.1 Env validation inconsistency (two definitions of “required env”)

- **Public health** uses `validateSystemRuntimeEnv()` → only **SYSTEM_MOTOR_SECRET** is required.  
- **Superadmin system health** uses `runHealthChecks()` → which calls `getRuntimeFacts()` → which **requireEnv**: ORDER_BACKUP_EMAIL, SMTP_HOST, SMTP_PORTS, IMAP_HOST, IMAP_PORT.

**Effect:** Public GET `/api/health` can return 200 (env “ok”) while superadmin system dashboard shows runtime “fail” (missing mail env). Two different “required env” lists; no single canonical list.

**Exact files:**

- `lib/env/system.ts` — REQUIRED_SYSTEM_RUNTIME_KEYS = ["SYSTEM_MOTOR_SECRET"]
- `lib/system/runtimeFacts.ts` — requireEnv(ORDER_BACKUP_EMAIL, SMTP_*, IMAP_*)
- `app/api/health/route.ts` — uses validateSystemRuntimeEnv only
- `lib/system/health.ts` — uses getRuntimeFacts()

### 3.2 Audit delivery not guaranteed

- `writeAudit()` is fail-quiet: if `supabaseAdmin()` fails or insert fails, the event is skipped (and optionally logged to console). No retry, no dead-letter.

**Effect:** Under Supabase outage or misconfiguration, audit events can be lost. Acceptable for “audit must not break the request,” but not guaranteed delivery.

**Exact files:**

- `lib/audit/log.ts` — getSupabaseAdmin() returns null on throw; writeAudit returns without writing; catch logs and does not rethrow

### 3.3 sanity:live not in CI

- AGENTS.md K11 states release gate: “sanity:live passes.”
- `package.json` defines `sanity:live` (scripts/sanity-live.mjs).
- **No** `.github/workflows/*.yml` file runs `npm run sanity:live` or `sanity-live`.

**Effect:** Merges can happen without ever running sanity:live in CI; the documented release gate is not enforced by automation.

**Exact files:**

- `AGENTS.md` (K11)
- `package.json` (script sanity:live)
- `.github/workflows/ci.yml`, `.github/workflows/ci-enterprise.yml` (no sanity:live step)

---

## 4. Top Blockers Preventing ≥100% Enterprise Readiness

| # | Blocker | Impact | Exact files / locations |
|---|---------|--------|---------------------------|
| 1 | **Env validation split** | Two “required env” definitions; health and superadmin system can disagree; operators lack one canonical checklist. | `lib/env/system.ts`, `lib/system/runtimeFacts.ts`, `app/api/health/route.ts`, `lib/system/health.ts` |
| 2 | **sanity:live not in CI** | Documented release gate not enforced; live smoke can regress without CI failing. | `AGENTS.md` (K11), `package.json`, `.github/workflows/ci.yml`, `.github/workflows/ci-enterprise.yml` |
| 3 | **Audit best-effort only** | No guaranteed delivery under failure; compliance/audit may require “never drop” or retry/dead-letter. | `lib/audit/log.ts` |

---

## 5. Single Points of Failure (Informational)

- **supabaseAdmin()**: Singleton; if it throws (e.g. missing env), all admin-backed routes fail. By design (fail-closed); no circuit breaker in code.
- **runHealthChecks()**: If getRuntimeFacts() throws (missing mail env), statusAggregator catches and returns critical status; no crash.

---

## 6. What Was Not Added (Per Instructions)

- No speculative “enterprise features.”
- No changes to code; discovery only.
- No new requirements beyond what was verified in the codebase and tests.

---

## 7. Recommended Next Steps (Hardening)

1. **Unify required env:** Either extend `validateSystemRuntimeEnv()` to include mail-related keys (and use that in runHealthChecks), or document two tiers (“minimal for public health” vs “full for superadmin”) and ensure both are documented in one place (e.g. docs/HEALTH_CRON_TRUTH or new docs/env-required.md).
2. **Add sanity:live to CI:** Add a step in ci.yml and/or ci-enterprise.yml that runs `npm run sanity:live` (with appropriate timeout and env), so the K11 gate is mechanically enforced.
3. **Audit delivery (optional):** If compliance requires guaranteed audit delivery, consider retry queue or dead-letter and document in audit log contract; otherwise explicitly document “best-effort, fail-quiet” in audit policy.

---

*End of Enterprise Readiness Discovery Report.*
