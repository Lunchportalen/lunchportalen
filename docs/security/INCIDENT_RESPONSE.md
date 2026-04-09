# Security incident logging standard (lightweight)

## What counts as a security-relevant signal

| Signal | Typical source | Severity (initial triage) |
|--------|----------------|---------------------------|
| `tenant_violation_attempt` | `authLog` (`lib/auth/log.ts`), e.g. support report body drift | High — possible cross-tenant probe |
| `TENANT_VIOLATION` | `audit_events` via `auditLog` (`lib/audit/log.ts`) | High |
| `ACCESS_DENIED` / failed login spikes | `auditLog` on login; HTTP 401/403 rates | Medium — brute force or misconfig |
| `IDENTITY_MISMATCH` / `TENANT_MISMATCH` in AI resolve | `auditLog` + `authLog` | High |
| Repeated 403 on same `rid` prefix / user | API logs + `audit_rid` in `detail` | Medium |

## Response steps (engineering)

1. **Correlate:** Use `rid` from JSON responses and `audit_rid` / `detail.rid` in `audit_events.detail`.
2. **Identify subject:** `actor_user_id`, `actor_role`, `detail.company_id` where present.
3. **Scope impact:** Determine resource (`entity_type` / `resource` field) and time window (`created_at` on row).
4. **Contain:** Rotate credentials if compromise suspected; block abusive IP at edge (deployment-specific).
5. **Record:** Track in org incident tracker (outside this repo).

## What this repo does *not* provide

- Automated paging, SOAR, or SIEM connectors — configure in infrastructure.
- Legal / customer notification templates — own by GRC.
