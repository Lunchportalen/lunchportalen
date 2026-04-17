# Security & compliance documentation

**Enterprise-inngang (salgs-/due diligence-pakke):** [docs/enterprise/README.md](../enterprise/README.md)

| Document | Purpose |
|----------|---------|
| [SOC2_CONTROL_MATRIX.md](./SOC2_CONTROL_MATRIX.md) | TSC-style mapping to code and status |
| [AUDIT_COVERAGE.md](./AUDIT_COVERAGE.md) | What `auditLog` / related paths record |
| [TENANT_ISOLATION.md](./TENANT_ISOLATION.md) | Tenant authority and exceptions |
| [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) | Engineering triage using `rid` / audit rows |

**Helpers (opt-in, not auto-wired):**

- `lib/security/selfCheck.ts` — `runSecuritySelfCheck(ctx)`
- `lib/security/invariants.ts` — `assertAuditInvariant(ctx)` (warn only)

**Note:** A probabilistic read-audit sampler was **not** added, to avoid changing runtime behavior or DB write patterns.
