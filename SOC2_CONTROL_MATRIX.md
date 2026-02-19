# 🛡 LUNCHPORTALEN – SOC 2 CONTROL MATRIX

Dette dokumentet mapper Lunchportalen sine tekniske og organisatoriske kontroller
mot SOC 2 Trust Service Criteria (TSC).

Scope: Security (obligatorisk) + Availability + Confidentiality + Processing Integrity

Dette dokumentet brukes som:

- Forberedelse til SOC 2 Type I / II
- Intern kontrollmatrise
- Due diligence dokument
- Revisjonsgrunnlag

---

# 1️⃣ SECURITY (CC1–CC9)

---

## CC1 – Control Environment

| Kontroll | Implementering | Evidens |
|-----------|---------------|---------|
| Arkitektur-dokumentasjon | SECURITY_ARCHITECTURE.md | Repo |
| Risikoanalyse | RISK_REGISTER.md | Repo |
| Threat Model | THREAT_MODEL.md | Repo |
| Styregjennomgang | BOARD_LEVEL_SUMMARY.md | Repo |

Status: Implementert

---

## CC2 – Communication & Information

| Kontroll | Implementering | Evidens |
|-----------|---------------|---------|
| Dokumentert Incident Plan | INCIDENT_RESPONSE_PLAN.md | Repo |
| Disaster Recovery Plan | DISASTER_RECOVERY_PLAN.md | Repo |
| Business Continuity Plan | BUSINESS_CONTINUITY_PLAN.md | Repo |

Status: Implementert

---

## CC3 – Risk Assessment

| Kontroll | Implementering | Evidens |
|-----------|---------------|---------|
| Identifiserte risikoer | RISK_REGISTER.md | Repo |
| Periodisk revisjon | ADR + Risk update | Git history |

Status: Implementert

---

## CC4 – Monitoring Activities

| Kontroll | Implementering | Evidens |
|-----------|---------------|---------|
| Logging via ops_events | DB design | Schema |
| CI-guard | scripts/ci-guard.mjs | CI logs |
| Preflight pipeline | package.json + CI | GitHub Actions |

Status: Implementert

---

## CC5 – Control Activities

| Kontroll | Implementering | Evidens |
|-----------|---------------|---------|
| RLS enforcement | Postgres RLS | Schema |
| RPC-only writes | lp_order_set / cancel | DB functions |
| Service-role allowlist | CI guard | Repo |
| UNIQUE constraints | orders(user_id,date) | Schema |

Status: Implementert

---

## CC6 – Logical & Physical Access

| Kontroll | Implementering | Evidens |
|-----------|---------------|---------|
| Supabase Auth | JWT | Config |
| Rollemodell | profiles.role | Schema |
| Tenant-isolasjon | Composite FK | Schema |
| Ingen direkte writes | REVOKE INSERT/UPDATE | Schema |

Status: Implementert

---

## CC7 – System Operations

| Kontroll | Implementering | Evidens |
|-----------|---------------|---------|
| Retention policy | lp_retention_cleanup | DB function |
| Backup (Supabase PITR) | Supabase plan | Provider doc |
| Monitoring | Health endpoints | API |

Status: Implementert

---

## CC8 – Change Management

| Kontroll | Implementering | Evidens |
|-----------|---------------|---------|
| PR review | Git workflow | Git history |
| CI hardening | ci:guard + preflight | CI logs |
| ADR documentation | ARCHITECTURE_DECISIONS.md | Repo |
| No manual overrides | CODEX policy | Repo |

Status: Implementert

---

## CC9 – Risk Mitigation

| Kontroll | Implementering | Evidens |
|-----------|---------------|---------|
| Cut-off enforcement | lp_cutoff_ok | DB function |
| ACTIVE agreement gate | lp_has_active_agreement | DB function |
| Idempotency | UNIQUE + ON CONFLICT | Schema |
| No DELETE on orders | Policy | Schema |

Status: Implementert

---

# 2️⃣ AVAILABILITY (A1)

| Kontroll | Implementering | Evidens |
|-----------|---------------|---------|
| Fail-closed design | DB-level enforcement | Schema |
| Disaster Recovery | DR Plan | Repo |
| Backup strategy | Supabase PITR | Provider |
| RTO/RPO defined | DR Plan | Repo |

Status: Implementert

---

# 3️⃣ CONFIDENTIALITY (C1)

| Kontroll | Implementering | Evidens |
|-----------|---------------|---------|
| Multi-tenant isolation | Composite FK + RLS | Schema |
| Role-based access | profiles.role | Schema |
| No global SELECT | RLS | Schema |
| No service-role misuse | CI allowlist | CI |

Status: Implementert

---

# 4️⃣ PROCESSING INTEGRITY (PI1)

| Kontroll | Implementering | Evidens |
|-----------|---------------|---------|
| Deterministic order logic | RPC-only writes | DB |
| Cut-off enforcement | DB-level | DB |
| Agreement validation | DB-level | DB |
| Snapshot consistency | kitchen_snapshots | Schema |

Status: Implementert

---

# 5️⃣ PRIVACY (Optional)

| Kontroll | Implementering | Evidens |
|-----------|---------------|---------|
| Dataminimering | Minimal fields | Schema |
| Retention | Cleanup function | DB |
| Role isolation | RLS | Schema |
| GDPR alignment | COMPLIANCE_OVERVIEW.md | Repo |

Status: Implementert

---

# 6️⃣ CONTROL MATURITY

| Domene | Modenhet |
|--------|----------|
| Security Architecture | Høy |
| Database Enforcement | Høy |
| CI Hardening | Høy |
| Documentation | Høy |
| Operational Process Formalization | Moderat–Høy |

---

# 7️⃣ GAP SUMMARY (FOR TYPE I)

Teknisk fundament er klart.

Før ekstern SOC 2 Type I bør følgende formaliseres:

- Access Control Policy (separat dokument)
- Change Management Policy
- Vendor Management Policy
- Dokumentert onboarding/offboarding prosess
- Periodisk tilgangsrevisjon (prosedyre)

---

# 8️⃣ KONKLUSJON

Lunchportalen oppfyller tekniske krav for:

- Security
- Availability
- Confidentiality
- Processing Integrity

Arkitekturen er SOC 2-aligned.

Videre arbeid handler primært om:

- Prosessformalisering
- Evidenssamling over tid (Type II)
- Periodisk kontrollgjennomgang
