# 🛡 LUNCHPORTALEN – ISO 27001 ALIGNMENT MATRIX

Dette dokumentet mapper Lunchportalen sine eksisterende kontroller
mot ISO/IEC 27001:2022 Annex A.

Formål:

- Vurdere modenhet
- Identifisere gap
- Forberede sertifiseringsløp
- Dokumentere alignment for enterprise-kunder

---

# 1️⃣ ORGANISASJONSKONTROLLER (Annex A – Organizational)

## A.5 – Information Security Policies

| Kontroll | Implementering | Status |
|----------|---------------|--------|
| Overordnet sikkerhetsrammeverk | SECURITY_ARCHITECTURE.md | Implementert |
| Risk management | RISK_REGISTER.md | Implementert |
| Incident Response | INCIDENT_RESPONSE_PLAN.md | Implementert |
| DR & BCP | DISASTER_RECOVERY_PLAN.md + BUSINESS_CONTINUITY_PLAN.md | Implementert |

Gap:
- Formell styregodkjenning av sikkerhetspolicy (prosedyre)

---

## A.6 – Organization of Information Security

| Kontroll | Implementering | Status |
|----------|---------------|--------|
| Rolledefinisjon | profiles.role + dokumentasjon | Implementert |
| Separation of duties | RPC + RLS + no admin override | Implementert |
| Governance documentation | BOARD_LEVEL_SUMMARY.md | Implementert |

Gap:
- Formell “Security Officer” rollebeskrivelse

---

## A.7 – Human Resource Security

| Kontroll | Implementering | Status |
|----------|---------------|--------|
| Onboarding | Registrerings- og rolleprosess | Delvis |
| Offboarding | Deaktivering via profile.active | Delvis |
| Code review policy | CI + PR-prosess | Implementert |

Gap:
- Dokumentert HR-policy for tilgangsopphør
- Sikkerhetsopplæring formalisert

---

## A.8 – Asset Management

| Kontroll | Implementering | Status |
|----------|---------------|--------|
| Identifiserte kritiske systemer | Dokumentert i Security Architecture | Implementert |
| Dataklassifisering | COMPLIANCE_OVERVIEW.md | Delvis |
| Retention policy | DB cleanup-funksjon | Implementert |

Gap:
- Formell asset register

---

## A.9 – Access Control

| Kontroll | Implementering | Status |
|----------|---------------|--------|
| Least privilege | Rollemodell + RLS | Implementert |
| Multi-tenant isolation | Composite FK + RLS | Implementert |
| Service-role allowlist | CI guard | Implementert |
| No direct writes | RPC-only enforcement | Implementert |

Gap:
- Periodisk tilgangsrevisjon dokumentert

---

## A.10 – Cryptography

| Kontroll | Implementering | Status |
|----------|---------------|--------|
| TLS enforcement | HTTPS (Vercel/Supabase) | Implementert |
| Secrets management | GitHub/Vercel secrets | Implementert |
| No plaintext secrets | CI enforcement | Implementert |

Gap:
- Dokumentert nøkkelrotasjonspolicy

---

## A.12 – Operations Security

| Kontroll | Implementering | Status |
|----------|---------------|--------|
| Logging | ops_events | Implementert |
| Change management | CI + ADR | Implementert |
| Backup | Supabase PITR | Implementert |
| Monitoring | Health endpoints | Delvis |

Gap:
- Formell overvåkningspolicy
- Dokumentert log-review-prosess

---

## A.14 – System Acquisition, Development & Maintenance

| Kontroll | Implementering | Status |
|----------|---------------|--------|
| Secure coding | CODEX policy | Implementert |
| CI guard | ci:guard | Implementert |
| No exception rule | Dokumentert | Implementert |
| Deterministic DB enforcement | RPC + RLS | Implementert |

Gap:
- Formell Secure Development Lifecycle (SDLC) dokument

---

## A.15 – Supplier Relationships

| Kontroll | Implementering | Status |
|----------|---------------|--------|
| Supabase DPA | Avtale | Ekstern |
| Vercel security | Leverandørdokumentasjon | Ekstern |
| Sanity DPA | Avtale | Ekstern |

Gap:
- Vendor Management Policy dokument

---

## A.16 – Information Security Incident Management

| Kontroll | Implementering | Status |
|----------|---------------|--------|
| Incident Response Plan | Dokumentert | Implementert |
| Logging | ops_events | Implementert |
| Root cause process | Dokumentert | Implementert |

Gap:
- Formell hendelsesøvelseslogg

---

## A.17 – Business Continuity

| Kontroll | Implementering | Status |
|----------|---------------|--------|
| BCP | BUSINESS_CONTINUITY_PLAN.md | Implementert |
| DRP | DISASTER_RECOVERY_PLAN.md | Implementert |
| RTO/RPO | Definert | Implementert |

Gap:
- Dokumentert årlig DR-test

---

## A.18 – Compliance

| Kontroll | Implementering | Status |
|----------|---------------|--------|
| GDPR alignment | COMPLIANCE_OVERVIEW.md | Implementert |
| Risk register | RISK_REGISTER.md | Implementert |
| SOC 2 alignment | SOC2_CONTROL_MATRIX.md | Implementert |

Gap:
- Formell intern revisjonsprosess

---

# 2️⃣ TEKNISK MODENHETSVURDERING

| Domene | Status |
|--------|--------|
| Database enforcement | Høy |
| Tenant isolation | Høy |
| Write control | Høy |
| CI hardening | Høy |
| Documentation | Høy |
| Organizational formalization | Moderat |

---

# 3️⃣ ISO 27001 READINESS ESTIMATE

Teknisk fundament: ~85–90% klart  
Organisatorisk/prosess-dokumentasjon: ~60–70% klart  

Total readiness (før Type I): 70–80%

---

# 4️⃣ NESTE STEG FOR SERTIFISERING

For å gå mot ISO 27001:

1. Etabler formell Information Security Policy
2. Definer Access Control Policy
3. Definer Change Management Policy
4. Definer Vendor Management Policy
5. Dokumenter årlig risikogjennomgang
6. Dokumenter periodisk tilgangsrevisjon
7. Dokumenter intern revisjonsprosess

---

# 5️⃣ KONKLUSJON

Lunchportalen er teknisk designet i tråd med ISO 27001-prinsipper:

- Least privilege
- Defense in depth
- Deterministic enforcement
- Logging & traceability
- Fail-closed architecture

Systemet krever primært formalisering av prosesser,
ikke arkitekturendring, for å nå ISO-sertifisering.
