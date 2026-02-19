# 🛡 LUNCHPORTALEN – STATEMENT OF APPLICABILITY (ISO/IEC 27001:2022)

Dette dokumentet er Lunchportalen sin Statement of Applicability (SoA).

Formålet med SoA er å:

- Liste relevante ISO 27001 Annex A-kontroller
- Dokumentere om kontrollen er anvendt eller ikke
- Begrunne inkludering eller ekskludering
- Referere til implementasjon og evidens

Scope:
Lunchportalen SaaS-plattform inkludert:

- Webapplikasjon (Next.js)
- Supabase (Auth + Postgres + RLS)
- Sanity (CMS)
- CI/CD pipeline
- Cron/System-motor
- Multi-tenant drift

Dato for siste oppdatering: __________

---

# 1️⃣ ORGANIZATIONAL CONTROLS (Annex A – 2022)

## A.5 Information Security Policies

Status: APPLICABLE – IMPLEMENTED

Begrunnelse:
Krav om dokumentert sikkerhetsrammeverk.

Implementasjon:
- SECURITY_ARCHITECTURE.md
- MASTER_SECURITY_POLICY.md (hvis etablert)
- BOARD_LEVEL_SUMMARY.md

---

## A.6 Organization of Information Security

Status: APPLICABLE – IMPLEMENTED

Begrunnelse:
Definerer ansvar og roller.

Implementasjon:
- Rollemodell (profiles.role)
- Governance-dokumenter
- ARCHITECTURE_DECISIONS.md

---

## A.7 Human Resource Security

Status: APPLICABLE – PARTIALLY IMPLEMENTED

Begrunnelse:
Tilgang og roller knyttet til ansatte.

Implementasjon:
- Onboarding via invite-system
- Profile deactivation

Gap:
- Formell HR-prosessdokumentasjon

---

## A.8 Asset Management

Status: APPLICABLE – IMPLEMENTED

Begrunnelse:
System- og datakomponenter identifisert.

Implementasjon:
- Asset definert i SECURITY_ARCHITECTURE.md
- Dataklassifisering i DATA_GOVERNANCE_POLICY.md

---

## A.9 Access Control

Status: APPLICABLE – IMPLEMENTED

Begrunnelse:
Multi-tenant SaaS krever streng tilgangskontroll.

Implementasjon:
- Supabase Auth
- RLS
- Composite FK
- RPC-only writes
- Service-role allowlist

---

## A.10 Cryptography

Status: APPLICABLE – IMPLEMENTED

Begrunnelse:
Beskyttelse av data i transit og secrets.

Implementasjon:
- TLS via Vercel/Supabase
- Secrets via GitHub/Vercel
- Ingen hardkodede nøkler

---

## A.12 Operations Security

Status: APPLICABLE – IMPLEMENTED

Begrunnelse:
Krever logging, backup og driftsovervåkning.

Implementasjon:
- ops_events logging
- Supabase backup (PITR)
- Retention policy
- INCIDENT_RESPONSE_PLAN.md
- DISASTER_RECOVERY_PLAN.md

---

## A.14 System Acquisition, Development & Maintenance

Status: APPLICABLE – IMPLEMENTED

Begrunnelse:
Secure SDLC er kritisk for SaaS.

Implementasjon:
- CI guard
- CODEX_DATAWRITE.md
- CODEX_CHECKLIST.md
- Preflight krav
- ADR-logg

---

## A.15 Supplier Relationships

Status: APPLICABLE – IMPLEMENTED

Begrunnelse:
Avhengighet av tredjepartsleverandører.

Leverandører:
- Supabase
- Vercel
- Sanity

Tiltak:
- DPA
- Leverandørdokumentasjon

---

## A.16 Information Security Incident Management

Status: APPLICABLE – IMPLEMENTED

Implementasjon:
- INCIDENT_RESPONSE_PLAN.md
- Logging via ops_events
- Red Team Simulation Playbook

---

## A.17 Business Continuity

Status: APPLICABLE – IMPLEMENTED

Implementasjon:
- BUSINESS_CONTINUITY_PLAN.md
- DISASTER_RECOVERY_PLAN.md
- Definerte RTO/RPO

---

## A.18 Compliance

Status: APPLICABLE – IMPLEMENTED

Implementasjon:
- COMPLIANCE_OVERVIEW.md
- RISK_REGISTER.md
- SOC2_CONTROL_MATRIX.md
- ISO27001_ALIGNMENT_MATRIX.md

---

# 2️⃣ TECHNICAL CONTROLS (ANNEX A 2022)

ISO 27001:2022 grupperer kontroller i:

- Organizational
- People
- Physical
- Technological

Lunchportalen dekker primært:

- Organizational
- Technological

Fysiske kontroller håndteres av leverandører (Supabase/Vercel).

---

# 3️⃣ EXCLUDED CONTROLS

Følgende kontroller er vurdert som:

NOT APPLICABLE:

- Fysisk sikkerhet på datasenter (leverandøransvar)
- On-premise network security
- Biometrisk autentisering
- Industriell kontrollsystem-sikkerhet

Begrunnelse:
Lunchportalen er en ren cloud-SaaS uten fysisk infrastruktur.

---

# 4️⃣ RISIKOBASERT VURDERING

Alle inkluderte kontroller er valgt basert på:

- Threat Model
- Risk Register
- Multi-tenant arkitektur
- Deterministisk drift
- Compliance-krav

Kontroller ekskluderes kun dersom:

- Ikke relevant for SaaS-modellen
- Håndtert av leverandør
- Ikke del av systemets scope

---

# 5️⃣ OPPDATERING

Dette dokumentet oppdateres ved:

- Endring i systemarkitektur
- Nye roller
- Nye kritiske skriveveier
- Endring i leverandører
- Årlig revisjon
- ISO-revisjonsforberedelse

---

# 6️⃣ GODKJENNING

Godkjent av:

- CTO: ___________________
- Sikkerhetsansvarlig: ___________________
- Ledelse: ___________________

Dato: ___________________
