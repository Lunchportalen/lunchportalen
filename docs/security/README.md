# Security & compliance documentation

**Enterprise-inngang (salgs-/due diligence-pakke):** [docs/enterprise/README.md](../enterprise/README.md)

| Document | Purpose |
|----------|---------|
| [SOC2_CONTROL_MATRIX.md](./SOC2_CONTROL_MATRIX.md) | TSC-style mapping to code and status |
| [audit-coverage.md](./audit-coverage.md) | What `auditLog` / related paths record |
| [tenant-isolation.md](./tenant-isolation.md) | Tenant authority and exceptions |
| [incident-response.md](./incident-response.md) | Engineering triage using `rid` / audit rows |

**Helpers (opt-in, not auto-wired):**

- `lib/security/selfCheck.ts` — `runSecuritySelfCheck(ctx)`
- `lib/security/invariants.ts` — `assertAuditInvariant(ctx)` (warn only)

**Note:** A probabilistic read-audit sampler was **not** added, to avoid changing runtime behavior or DB write patterns.
