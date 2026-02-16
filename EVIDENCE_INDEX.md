# LUNCHPORTALEN — EVIDENCE INDEX

Version: 1.0  
Purpose: Bevisoversikt for revisjon, konsernsalg og compliance  

---

## 1. System Evidence

| ID | Beskrivelse | Dokument | Sist validert |
|----|------------|----------|---------------|
| EV-001 | RLS fail-closed test | rls_tests.sql | YYYY-MM-DD |
| EV-002 | RID determinisme | api_contract.md | YYYY-MM-DD |
| EV-003 | Cut-off 08:00 enforcement | orders_api.ts | YYYY-MM-DD |
| EV-004 | Multi-tenant isolation | database_schema.md | YYYY-MM-DD |

---

## 2. Operational Evidence

| ID | Beskrivelse | Kilde | Dato |
|----|------------|-------|------|
| OP-001 | Daglig produksjonsrapport | kitchen_log | YYYY-MM-DD |
| OP-002 | Backup test | backup_report | YYYY-MM-DD |
| OP-003 | Incident drill | incident_protocol | YYYY-MM-DD |

---

## 3. Security Evidence

| ID | Beskrivelse | Kilde |
|----|------------|------|
| SEC-001 | Role gating test | auth_flow |
| SEC-002 | Token validation | auth_server |
| SEC-003 | API no-store headers | http_contract |
| SEC-010 | Kitchen/Driver scope locked (TENANT-BOUND) | ROLE_MATRIX.md |
| SEC-011 | Kitchen/Driver RLS policy validation | RLS_POLICIES.md |
| OP-010 | Kitchen/Driver scope review plan | AUDIT_CALENDAR.md |

---

## 4. Compliance Evidence

| ID | Beskrivelse | Dokument |
|----|------------|----------|
| GDPR-001 | Data flow mapping | GDPR_OVERVIEW.md |
| GDPR-002 | Role matrix validation | ROLE_MATRIX.md |
| GDPR-003 | Data minimization audit | DATA_PROCESSING.md |

---

## 5. Audit Trail Reference

All system changes must include:

- Commit ID
- RID
- Change summary
- Approval reference
- Date
- Owner

---

## 6. Audit Readiness Status

Technical Integrity: PASS / REVIEW  
Data Isolation: PASS / REVIEW  
Compliance: PASS / REVIEW  
Operational Stability: PASS / REVIEW  

Overall Status: GREEN / YELLOW / RED
