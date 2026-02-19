# 🛡 LUNCHPORTALEN – SOC 2 PREPARATION OUTLINE

Dette dokumentet beskriver hvordan Lunchportalen forbereder seg på SOC 2 Type I og Type II.

Fokusområder:

- Security
- Availability
- Confidentiality
- Processing Integrity
- Privacy (der relevant)

---

# 1️⃣ OVERORDNET STRATEGI

SOC 2 handler ikke bare om teknologi – det handler om:

- Prosesser
- Kontrollmiljø
- Dokumentasjon
- Sporbarhet
- Konsistent praksis

Lunchportalen har allerede teknisk arkitektur som støtter SOC 2.
Dette dokumentet beskriver hva som må struktureres for revisjon.

---

# 2️⃣ TRUST SERVICE CRITERIA (TSC)

## 2.1 Security (Obligatorisk)

### Status

Lunchportalen har:

- RLS-basert tilgangskontroll
- RPC-only writes
- CI-hardening
- Service-role allowlist
- Logging via ops_events
- Disaster Recovery Plan
- Incident Response Plan
- Risk Register

### Tiltak før revisjon

- Dokumenter tilgangsprosess (user provisioning/deprovisioning)
- Dokumenter code review-prosess
- Dokumenter secret management
- Dokumenter change management

---

## 2.2 Availability

### Status

- Fail-closed arkitektur
- Supabase backup + PITR
- Disaster Recovery Plan
- Business Continuity Plan

### Tiltak før revisjon

- Definer SLA (internt mål)
- Definer RTO/RPO eksplisitt
- Overvåkningsdokumentasjon
- Uptime-måling

---

## 2.3 Confidentiality

### Status

- Multi-tenant isolasjon
- Composite FK
- RLS enforcement
- Service-role kontroll

### Tiltak før revisjon

- Klassifiser data (public / internal / confidential)
- Dokumenter tilgangsnivå per rolle
- Dokumenter datalagring per system

---

## 2.4 Processing Integrity

### Status

- Deterministiske RPC-er
- Cut-off enforcement
- Agreement-gate
- UNIQUE constraints
- Idempotens

### Tiltak før revisjon

- Dokumenter input-validering
- Dokumenter feilkoder og kontrakter
- Dokumenter testprosedyrer

---

## 2.5 Privacy (Valgfritt, avhengig av scope)

### Status

- GDPR alignment
- Dataminimering
- Retention policy
- Kunde = behandlingsansvarlig

### Tiltak før revisjon

- Dokumenter data lifecycle
- Dokumenter slettingsprosess
- Dokumenter innsynsprosess

---

# 3️⃣ KONTROLLDOMENER

SOC 2 krever mer enn kode.

Dette må formaliseres:

---

## 3.1 Access Control

- Onboarding-prosess for ansatte
- Offboarding-prosess
- Role assignment policy
- Least privilege policy
- Periodisk tilgangsrevisjon

---

## 3.2 Change Management

- Pull Request review
- CI gate før merge
- Preflight før deploy
- Ingen direkte endringer i produksjon
- Dokumenterte ADR-er

---

## 3.3 Logical Security

- Secrets i GitHub/Vercel
- Ingen secrets i repo
- Service-role allowlist
- CI guard

---

## 3.4 Monitoring

- System visibility API
- Ops-events logging
- Incident logging
- Retention policy

---

## 3.5 Incident Response

- INCIDENT_RESPONSE_PLAN.md
- Dokumentert prosess
- Root cause analyse
- Årlig øvelse

---

# 4️⃣ GAP ANALYSE (VANLIGE MANGLER)

Før SOC 2 Type I bør følgende være på plass:

- Formell Access Control Policy
- Formell Change Management Policy
- Dokumentert onboarding/offboarding prosess
- Dokumentert vendor management
- Dokumentert logging retention policy
- Dokumentert monitoring plan

Teknisk arkitektur er moden.
Prosessdokumentasjon må formaliseres.

---

# 5️⃣ ROADMAP MOT SOC 2 TYPE I

### Fase 1 – Dokumentasjon (0–2 måneder)

- Fullføre policy-dokumenter
- Formalisere prosesser
- Lage kontrollmatrise
- Samle evidens

### Fase 2 – Intern gjennomgang (1–2 måneder)

- Gjennomgå kontrollmiljø
- Justere mangler
- Dokumentere prosedyrer

### Fase 3 – Ekstern revisjon (Type I)

- Punktvurdering av kontroller

---

# 6️⃣ ROADMAP MOT SOC 2 TYPE II

Type II krever 3–12 måneder bevisperiode.

Tiltak:

- Stabil kontrollgjennomføring
- Logging av alle kontroller
- Månedlig gjennomgang
- Periodisk tilgangsrevisjon
- Incident-dokumentasjon

---

# 7️⃣ STYREANSVAR

Styret må:

- Godkjenne sikkerhetsstrategi
- Følge opp risikoregister
- Godkjenne ressurser til compliance
- Overvåke kontrollmiljø

---

# 8️⃣ KONKLUSJON

Lunchportalen er teknisk forberedt for SOC 2.

For å oppnå sertifisering må:

- Prosesser formaliseres
- Kontroller dokumenteres
- Evidens samles over tid

Arkitekturen støtter SOC 2.
Organisatorisk struktur må fullføres.

Dette dokumentet danner grunnlag for videre compliance-løp.
