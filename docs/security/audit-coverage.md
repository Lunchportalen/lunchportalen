# Audit event coverage map

**Canonical logger:** `auditLog` + `buildAuditEvent` / `buildAuditEventFromAuthedCtx` in `lib/audit/log.ts` (persists to `audit_events` when service role configured; console in non-production or `LP_DEBUG_AUDIT=1`).

**Supplementary:** `authLog` in `lib/auth/log.ts` (dev / `LP_DEBUG_AUTH=1` in production) for auth tracing — not the same table as `audit_events`.

| Event (`AuditAction`) | Trigger location | Logged fields (high level) | What it supports |
|----------------------|------------------|----------------------------|------------------|
| `LOGIN` | `app/api/auth/login/route.ts` (success) | `userId`, `resource` `auth:login`, `resourceId`, `rid`, `metadata.outcome` | Successful authentication event (no password; no email in audit row) |
| `ACCESS_DENIED` | `app/api/auth/login/route.ts` (failed credentials) | `rid`, `resource` `auth:login`, `metadata.reason` | Failed login attempt (no user id) |
| `ACCESS_DENIED` | `lib/auth/resolveAiTenant.ts` (no session) | `userId`/`role`/`companyId` from `getAuthContext`, `rid`, `metadata.code` `UNAUTHORIZED` | AI entry blocked without session |
| `TENANT_VIOLATION` | `lib/auth/assert.ts` → `logTenantViolation` | `requestedCompanyId` in `metadata`, tenant + role on row | Cross-tenant assertion failure when callers use `logTenantViolation` |
| `TENANT_VIOLATION` | `lib/auth/resolveAiTenant.ts` (identity / company drift) | `metadata.code` `IDENTITY_MISMATCH` or `TENANT_MISMATCH`, optional `bodyCompanyId` | Client/body mismatch vs session tenant |
| `CREATE` / `UPDATE` | `app/api/orders/set/route.ts` (after successful `lp_order_set`) | `resource` `orders:set`, `resourceId` order id, `metadata.date`, `orderAction`, route surface | Proof of order mutation intent (not full payload) |
| `AI_EXECUTION` | `app/api/ai/block/route.ts` (after successful run) | `resource` `ai:block`, `metadata.textLen`, `blockSubAction` | AI tool invocation attributed to session (async `getAuthContext`) |

## Not exhaustive

- Other routes may write `audit_events` via legacy paths (e.g. support report, superadmin flows). This table lists the **unified `auditLog` pipeline** introduced under `lib/audit/`.
- **Read** actions are generally not logged except where legacy code already inserts rows.
