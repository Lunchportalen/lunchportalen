# LUNCHPORTALEN — DOCUMENTATION OVERVIEW

Version: 1.0  
Status: Locked (Enterprise Baseline)  
Owner: Superadmin  
Last Updated: 2026-02-16  

---

## 1. Purpose

Dette dokumentet definerer den offisielle dokumentstrukturen for Lunchportalen.
Alt arbeid, endringer og revisjoner skal spores mot denne oversikten.

Ingen dokumenter eksisterer utenfor dette systemet.

---

## 2. Core Documentation Layers

### 2.1 Governance Layer (Strategisk nivå)

| Dokument | Formål | Status |
|----------|--------|--------|
| MASTER_BLUEPRINT.md | Produktets totale fasit | Locked |
| DESIGN_CONSTITUTION.md | UI/UX-prinsipper | Locked |
| AVENSIA_CHECKLIST.md | 10-punkts enterprise-test | Active |
| DECISION_TEST.md | Endringsvalidering | Mandatory |

---

### 2.2 Architecture Layer (Teknisk nivå)

| Dokument | Formål |
|----------|--------|
| SYSTEM_ARCHITECTURE.md | App + DB + Sanity struktur |
| DATABASE_SCHEMA.md | Endelig datamodell |
| RLS_POLICIES.md | Multi-tenant isolasjon |
| API_CONTRACT.md | RID, no-store, fail-closed |

---

### 2.3 Operational Layer (Drift)

| Dokument | Formål |
|----------|--------|
| OPS_PLAYBOOK.md | Daglig drift |
| INCIDENT_PROTOCOL.md | Feilhåndtering |
| SYSTEM_HEALTH.md | Overvåking |
| BACKUP_POLICY.md | Backup & gjenoppretting |

---

### 2.4 Compliance Layer

| Dokument | Formål |
|----------|--------|
| GDPR_OVERVIEW.md | Personvernstruktur |
| DATA_PROCESSING.md | DPA-ramme |
| ROLE_MATRIX.md | Rolle-tilgang |
| AUDIT_LOG_POLICY.md | Logging |

---

### 2.5 Evidence Layer

Se: `EVIDENCE_INDEX.md`

---

## 3. Documentation Rules

1. Én sannhetskilde per dokument.
2. Ingen duplisering.
3. Endringer krever versjonsøkning.
4. Alle endringer må referere til:
   - Rid
   - Commit hash
   - Dato
   - Eier

---

## 4. Change Control

Alle dokumentendringer:

- Må registreres i `EVIDENCE_INDEX.md`
- Må valideres mot AVENSIA-testen
- Må ikke bryte No-Exception Rule

---

## 5. Status

Documentation Coverage: ____ %
Audit Ready: Yes / No
Next Audit: Se AUDIT_CALENDAR.md

---

## 6. Locked Decisions

- `SEC-KD-SCOPE-2026-02-16`: Kitchen/Driver scope is locked to `TENANT-BOUND` (`company_id` + `location_id`), with fail-closed deny when scope is missing.
- References:
  - `ROLE_MATRIX.md`
  - `RLS_POLICIES.md`
