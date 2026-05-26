# 🏢 LUNCHPORTALEN – ENTERPRISE SALES TECHNICAL PACK

Dette dokumentet gir en strukturert oversikt over Lunchportalen sin:

- Arkitektur
- Sikkerhetsmodell
- Databehandling
- Skalerbarhet
- Drift
- Compliance
- Governance

Formålet er å gi IT, Security og Procurement en rask og presis teknisk vurdering.

---

# 1️⃣ PRODUKTOVERSIKT

Lunchportalen er en multi-tenant SaaS-plattform for firmalunsj.

Designet for:

- Kontroll
- Forutsigbarhet
- Redusert matsvinn
- Lav administrasjonsbelastning
- Deterministisk produksjonsflyt

Systemet er database-first og fail-closed.

---

# 2️⃣ ARKITEKTUR

## Teknologistack

- Next.js (App Router)
- Supabase (Postgres + Auth + RLS)
- Sanity (CMS)
- Nodemailer (SMTP)
- GitHub Actions (CI)
- Vercel (Hosting)

## Arkitekturprinsipper

- Database-first enforcement
- RPC-only writes
- Row Level Security (RLS)
- Composite tenant-isolasjon
- No manual overrides
- Idempotent operasjoner

---

# 3️⃣ MULTI-TENANT ISOLASJON

Isolasjon håndheves via:

- company_id
- location_id
- Composite FK
- RLS policies
- Tenant-isolation test i CI

Ingen cross-tenant tilgang er mulig uten superadmin.

---

# 4️⃣ AUTENTISERING & AUTORISERING

## Autentisering

- Supabase Auth
- JWT-basert
- Secure cookies

## Autorisering

- Rollemodell:
  - employee
  - company_admin
  - superadmin
  - kitchen
  - driver
- RLS håndhever tilgang
- Ingen rolle bestemmes i frontend

---

# 5️⃣ DATAHÅNDTERING

## Persondata

Behandles:

- Navn
- E-post
- Firma-tilknytning
- Bestillingsvalg

Behandles ikke:

- Betalingskort
- Fødselsnummer
- Sensitive helseopplysninger

## Roller

- Kunde (firma) = behandlingsansvarlig
- Lunchportalen = databehandler

DPA kan inngås ved behov.

---

# 6️⃣ SIKKERHETSKONTROLLER

- RLS på kritiske tabeller
- RPC-only writes for orders
- Cut-off enforcement i DB
- ACTIVE agreement-gate
- UNIQUE constraint (idempotens)
- Logging via ops_events
- CI guard for service-role misuse
- REVOKE direkte writes i DB

---

# 7️⃣ DRIFT & RESILIENS

- Supabase daglig backup
- Point-in-time recovery
- Disaster Recovery Plan
- Business Continuity Plan
- Incident Response Plan
- Fail-closed arkitektur

---

# 8️⃣ SKALERBARHET

Designet for:

- 50 000+ firma
- 10+ millioner ansatte
- 10–20 millioner+ orders årlig

Skaleringsmekanismer:

- Indekser
- Retention policy
- Partisjonering ved behov
- Read replicas

Ingen redesign nødvendig ved 50k firma.

---

# 9️⃣ COMPLIANCE STATUS

- GDPR aligned
- SOC 2 alignment dokumentert
- ISO 27001 readiness strukturert
- Dokumentert risk register
- Dokumentert threat model

Sertifisering kan initieres ved behov.

---

# 🔟 LOGGING & AUDIT

Alle kritiske operasjoner:

- Logges
- Inneholder actor_user_id
- Inneholder company_id
- Inneholder payload
- Kan spores via ops_events

Ingen skjulte systemendringer.

---

# 1️⃣1️⃣ API & INTEGRASJON

Muligheter:

- Versjonert API
- Webhooks
- Enterprise SSO (planlagt/kan implementeres)
- SCIM provisioning (planlagt)
- ESG-eksport (roadmap)

Integrasjoner skjer uten å kompromittere sikkerhetsmodell.

---

# 1️⃣2️⃣ RISIKOOVERSIKT

Primære risikoer:

- Infrastruktur-outage
- Service-role misuse
- Utviklerfeil

Mitigering:

- Fail-closed design
- CI hardening
- Disaster Recovery Plan
- Dokumentert governance

Rest-risiko er håndtert og dokumentert.

---

# 1️⃣3️⃣ ENTERPRISE DIFFERENSIERING

Lunchportalen skiller seg ved:

- Deterministisk forretningslogikk
- Ingen individuelle unntak
- Lav administrasjonsstøy
- Høy switching cost
- Enterprise-vennlig dokumentasjon

Sikkerhet er integrert i arkitekturen.

---

# 1️⃣4️⃣ KONTAKT

For ytterligere teknisk dokumentasjon kan følgende leveres:

- Security Architecture
- Threat Model
- Risk Register
- SOC 2 Control Matrix
- ISO Alignment Matrix
- Disaster Recovery Plan
- Penetration Test Scope

---

# KONKLUSJON

Lunchportalen er en:

- Sikker
- Skalerbar
- Dokumentert
- Enterprise-klar
- Fail-closed plattform

Teknisk fundament støtter konsernkrav.
