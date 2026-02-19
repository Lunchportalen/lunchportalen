# LUNCHPORTALEN  
# ENTERPRISE_CONTROL_MAP.md  
Version: 1.0  
Status: ACTIVE GOVERNANCE DOCUMENT  
Owner: Superadmin  
Last updated: YYYY-MM-DD  

---

# 1. FORMÅL

Dette dokumentet definerer:

- Hvilke styringsdokumenter som er operative
- Hvilke dokumenter som styrer kode
- Hvilke dokumenter som styrer drift
- Hvilke dokumenter som styrer sikkerhet
- Hvilke dokumenter som er roadmap/informasjonsdokumenter
- Hvordan dokumentasjon kobles til CI, runtime og revisjon

Dette er kontrollkartet for hele Lunchportalen.

Master Blueprint v1.0 er overordnet grunnlov.  
Dette dokumentet beskriver hvordan øvrige dokumenter er forankret operativt.

---

# 2. HIERARKI (STYRINGSPYRAMIDE)

LEVEL 1 — KONSTITUSJON (IKKE OVERSTYRBAR)

- MASTER_BLUEPRINT_v3_POLICIES.md
- DESIGN_CONSTITUTION.md
- AVENSIA_DECISION_TEST.md
- NO_EXCEPTION_RULE.md (hvis egen fil)

Disse kan kun endres via FREEZE_PROTOCOL.md.

---

LEVEL 2 — OPERATIV SYSTEMSTYRING (KOBLET TIL KODE)

Disse dokumentene MÅ være reflektert i:

- CI gates
- RLS policies
- API guards
- Runtime validering

### 2.1 Arkitektur og sikkerhet

- SECURITY_ARCHITECTURE.md
- DATA_GOVERNANCE.md
- ZERO_TRUST_ROADMAP.md
- RBAC_MATRIX.md
- ACCESS_CONTROL_POLICY.md

Krav:
- Rollevalidering i alle API-ruter
- Fail-closed default
- Ingen fallback på tvers av company_id
- Alle responser skal være deterministiske

---

### 2.2 API- og runtime-kontroll

- API_FRAMEWORK.md
- RID_TRACKING.md
- FAILSAFE_STANDARD.md
- ERROR_HANDLING_STANDARD.md

Krav:
- Alle API-responser skal inkludere rid
- 08:00 cut-off valideres server-side (Europe/Oslo)
- Ingen silent fallbacks
- Idempotente operasjoner

---

### 2.3 Database og RLS

- DATABASE_ARCHITECTURE.md
- RLS_IMPLEMENTATION_PLAYBOOK.md
- INTERNAL_AUDIT_TEMPLATE.md

Krav:
- company_id + location_id enforced
- Superadmin isolert via systemRole
- Ingen cross-tenant select
- Audit-logg ved statusendringer

---

LEVEL 3 — DRIFT & INCIDENT CONTROL

Disse styrer operativ stabilitet.

- INCIDENT_RESPONSE_PLAN.md
- DISASTER_RECOVERY_PLAN.md
- RISK_ESCALATION.md
- BUSINESS_CONTINUITY_PLAN.md
- EXECUTIVE_MONITORING_DASHBOARD_BLUEPRINT.md
- SYSTEM_HEALTH.md

Krav:
- Daglig system-health snapshot
- Hendelser logges i system_incidents
- Backup-verifisering dokumentert
- Fail-closed ved kritisk feil

---

LEVEL 4 — REVISJON & COMPLIANCE

- SOC2_CONTROL_MATRIX.md
- ESG_SUSTAINABILITY_PLAN.md
- DATA_PRIVACY_POLICY.md
- INTERNAL_AUDIT_TEMPLATE.md
- CHANGE_MANAGEMENT_POLICY.md

Disse dokumentene skal:
- Kunne fremvises ved enterprise-salg
- Være versjonskontrollert
- Være konsistente med runtime-adferd

---

LEVEL 5 — KOMMERSIELL & ENTERPRISE READINESS

- ENTERPRISE_READINESS_BRIEF.md
- SALES_FRAMEWORK.md
- PRICING_LOGIC.md
- INVESTOR_BRIEF.md
- COMMERCIAL_EXECUTION_PLAYBOOK.md

Disse påvirker:
- Bindingstid (12 mnd)
- Minimum 20 ansatte
- No-exception rule
- Avtale → Pending → Superadmin approval → Active

---

LEVEL 6 — ROADMAP / STRATEGISK UTVIKLING

- ZERO_TRUST_ROADMAP.md
- ESG_SUSTAINABILITY_TECH_ROADMAP.md
- AI_PRINCIPLES.md
- TECH_DEBT_LOG.md
- VERTICAL_EXPANSION_STRATEGY.md

Disse er:
- Ikke operative før implementert
- Skal ikke bryte Master Blueprint
- Må bestå Avensia Decision Test før aktivering

---

# 3. CI-ENFORCEMENT MAP

| Dokument | CI-gate | Runtime enforcement |
|----------|---------|--------------------|
| RLS_IMPLEMENTATION_PLAYBOOK | rls-gate | Supabase RLS |
| FAILSAFE_STANDARD | agents-check | API guards |
| RID_TRACKING | audit-api | All JSON responses |
| CHANGE_MANAGEMENT_POLICY | CI PR approval | Merge control |
| SECURITY_ARCHITECTURE | lint + static analysis | Role guard |

Ingen dokumenter i Level 2 kan være “teoretiske”.  
Hvis de ikke er koblet til CI eller runtime → de er ikke operative.

---

# 4. ENDRE EN STYRINGSFIL

Alle endringer i:

- Level 1
- Level 2
- RLS
- Rollemodell
- Cut-off logikk
- Avtalestruktur

Krever:

1. Avensia Decision Test
2. Oppdatert ENTERPRISE_CONTROL_MAP.md
3. CI grønn
4. Dokumentert commit-melding

---

# 5. FORBUDT

- Uoverensstemmelse mellom dokumentasjon og kode
- Uoffisielle unntak
- Manuelle overstyringer uten audit-logg
- Endring i rollemodell uten oppdatering av RBAC_MATRIX.md
- Endring i 08:00 cut-off uten Blueprint-endring

---

# 6. STATUSMODELL

Dette dokumentet er:

ACTIVE GOVERNANCE CONTROL

Hvis det ikke oppdateres når nye styringsdokumenter legges til,
er governance brutt.

---

# 7. SAMMENDRAG

Lunchportalen styres av:

Blueprint → Kontrollmap → Runtime → CI → Audit

Ingen dokumenter eksisterer uten operativ forankring.

Dette dokumentet er kartet.
