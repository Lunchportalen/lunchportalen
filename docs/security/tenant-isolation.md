# Tenant isolation model

## Principles

1. **Server is the source of truth** for identity and tenant. The browser must not be trusted for `company_id`, `user_id`, or role.
2. **Authoritative tenant field:** `ctx.company_id` from `getAuthContext()` (membership-backed) or `scope.companyId` from `scopeOr401` / `getScope(req)` — both are server-derived from the authenticated session and profile data.
3. **Client input:** Query/body `companyId` / `company_id` must be validated against server context (or allowed only for roles explicitly designed for cross-tenant operations).
4. **AI routes:** `resolveAiTenantExecutionIds` (`lib/auth/resolveAiTenant.ts`) binds `companyId` and `userId` for execution to the session; **superadmin** must supply a UUID `companyId` in the body for cross-tenant AI operations.

## Operational exceptions

- **Kitchen** and **driver** roles: `canAccessCompany` (`lib/auth/guards.ts`) returns true for any `companyId` where product policy allows operational visibility. This is **intentional** for production/delivery workflows, not accidental bypass.
- **Superadmin:** cross-tenant access by design; must remain tightly role-gated in layouts and APIs.

## Related code

- `lib/auth/assert.ts` — `assertTenant`, `logTenantViolation`
- `lib/auth/guards.ts` — `canAccessCompany`, `canAccessLocation`
- `lib/auth/resolveAiTenant.ts` — AI tenant binding
- `docs/security/SOC2_CONTROL_MATRIX.md` — control mapping
