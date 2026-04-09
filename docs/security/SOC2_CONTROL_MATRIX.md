# SOC2-aligned control matrix (architecture)

**Scope:** Technical mapping of Lunchportalen controls to common SOC2 Trust Services Criteria (TSC). This is **not** a SOC2 report; it supports auditor walkthroughs and gap analysis.

**Legend:** **Implemented** = enforced in code. **Partial** = logging/docs only, policy-dependent, or not exhaustive across all routes.

| Control | TSC ref (typical) | Description | Implementation | Status |
|--------|-------------------|-------------|----------------|--------|
| Logical access — authentication | CC6.1 | Users are identified before protected use | `getAuthContext` (`lib/auth/getAuthContext.ts`), Supabase session via `lib/supabase/server.ts`, `scopeOr401` (`lib/http/routeGuard.ts`) | Implemented |
| Logical access — RBAC | CC6.1 | Actions limited by role | `lib/auth/roles.ts`, `lib/auth/guards.ts`, `requireRoleOr403` / `requireCompanyScopeOr403` (`lib/http/routeGuard.ts`) | Implemented |
| Credential protection | CC6.1 | Sessions via httpOnly cookies; no client-trusted tokens for server truth | `middleware.ts` (presence gate for `sb-access-token`), login/post-login cookie set (`app/api/auth/login/route.ts`, `app/api/auth/post-login/route.ts`) | Partial (full key mgmt is org process) |
| Data isolation — tenant | CC6.6 | Tenant data scoped server-side | `ctx.company_id` / scope from `getAuthContext` and `getScope`; `assertTenant` / `canAccessCompany` (`lib/auth/assert.ts`, `lib/auth/guards.ts`); `resolveAiTenantExecutionIds` (`lib/auth/resolveAiTenant.ts`) for AI routes | Partial (not every route audited; see matrix notes) |
| Data isolation — superadmin / ops | CC6.6 | Elevated roles documented | Superadmin allowlist + routes under `app/superadmin/**`, `app/api/superadmin/**` | Implemented |
| Audit logging | CC7.2 | Security-relevant events recorded | `auditLog` / `buildAuditEvent` (`lib/audit/log.ts`); `authLog` (`lib/auth/log.ts`) | Partial (coverage map: `AUDIT_COVERAGE.md`) |
| Monitoring / alerting | CC7.2 | Ops visibility | `lib/ops/log.ts`, observability wrappers (e.g. `observeResponse`), platform health surfaces | Partial (alerting is deployment-specific) |
| Change management | CC7.3 | Controlled changes | Git, CI workflows (`.github/workflows`), `AGENTS.md` / RC gates | Partial (process + tooling; not code-only) |
| Incident handling | CC7.4 / CC7.5 | Defined response expectations | `docs/security/INCIDENT_RESPONSE.md` | Partial (policy doc) |

## Notes for auditors

- **Source of truth for tenant:** server-derived `company_id` on context; see `docs/security/TENANT_ISOLATION.md`.
- **Kitchen / driver:** intentional cross-company operational read patterns where `canAccessCompany` returns true; still bound to authenticated profile for many routes.
- **Gaps:** Full CC6.6 coverage requires ongoing route inventory; not all `.from(` calls are listed here.
