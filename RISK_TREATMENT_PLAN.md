# 🛡 LUNCHPORTALEN – RISK TREATMENT PLAN

Dette dokumentet beskriver hvordan identifiserte risikoer håndteres.

Basert på:
- RISK_REGISTER.md
- THREAT_MODEL.md
- ISO 27001 Annex A
- SOC2_CONTROL_MATRIX.md

---

# 1️⃣ METODE

For hver risiko vurderes:

- Sannsynlighet
- Konsekvens
- Nåværende kontroll
- Behandlingsstrategi

Behandlingsstrategier:

- Mitigate (redusere)
- Avoid (unngå)
- Transfer (overføre)
- Accept (akseptere)

---

# 2️⃣ RISIKOBEHANDLINGSMATRISE

## R-01 Cross-tenant data leak
Strategi: Mitigate  
Tiltak:
- RLS enforcement
- Composite FK
- Tenant test i CI
Status: Aktiv

---

## R-02 Service-role misuse
Strategi: Mitigate  
Tiltak:
- CI guard
- Allowlist
- Code review
Status: Aktiv overvåkning

---

## R-03 Infrastructure outage
Strategi: Accept + Mitigate  
Tiltak:
- DR-plan
- Fail-closed design
- RTO/RPO definert
Status: Akseptert med kontroll

---

## R-04 Developer bypass
Strategi: Mitigate  
Tiltak:
- CODEX policy
- CI preflight
- ADR-krav
Status: Aktiv

---

# 3️⃣ ÅRLIG GJENNOMGANG

- Oppdater Risk Register
- Oppdater SoA
- Dokumenter eventuelle nye tiltak
- Styregodkjenning

---

Godkjent av: __________________  
Dato: __________________
