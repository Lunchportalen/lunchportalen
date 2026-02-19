# 📊 LUNCHPORTALEN – RISK REGISTER

Dette dokumentet beskriver identifiserte risikoer i Lunchportalen,
deres sannsynlighet, konsekvens og mitigeringstiltak.

Dette registeret oppdateres løpende ved:

- Nye funksjoner
- Endringer i arkitektur
- Incident
- Nye trusselvurderinger

---

# 1️⃣ RISIKOKLASSIFISERING

## Sannsynlighet
- Lav
- Moderat
- Høy

## Konsekvens
- Lav
- Moderat
- Høy
- Kritisk

## Risikonivå
Basert på kombinasjon av sannsynlighet og konsekvens.

---

# 2️⃣ TEKNISKE RISIKOER

---

## R-01: Cross-tenant data leak

**Beskrivelse:**  
En bruker får tilgang til data fra annet firma.

**Sannsynlighet:** Lav  
**Konsekvens:** Kritisk  
**Risikonivå:** Moderat  

**Mitigering:**
- Composite FK (company_id, location_id)
- RLS enforcement
- Tenant-isolation test i CI
- No direct global SELECT

**Status:** Kontrollert

---

## R-02: Cut-off bypass

**Beskrivelse:**  
Ansatt endrer bestilling etter 08:00.

**Sannsynlighet:** Lav  
**Konsekvens:** Høy  
**Risikonivå:** Lav  

**Mitigering:**
- DB-level cut-off enforcement
- RPC-only writes
- No-exception rule

**Status:** Kontrollert

---

## R-03: Service-role misuse

**Beskrivelse:**  
SUPABASE_SERVICE_ROLE_KEY brukes feil og omgår sikkerhet.

**Sannsynlighet:** Moderat  
**Konsekvens:** Høy  
**Risikonivå:** Moderat  

**Mitigering:**
- CI guard
- Allowlist
- Policy-dokumentasjon
- Code review

**Status:** Overvåkes

---

## R-04: Developer-introduced bypass

**Beskrivelse:**  
Ny kode omgår RPC eller RLS.

**Sannsynlighet:** Moderat  
**Konsekvens:** Høy  
**Risikonivå:** Moderat  

**Mitigering:**
- CI guard
- CODEX_CHECKLIST
- Architecture Decisions dokument
- Preflight før deploy

**Status:** Overvåkes

---

## R-05: Database corruption

**Beskrivelse:**  
Datakorrupt hendelse i orders eller agreements.

**Sannsynlighet:** Lav  
**Konsekvens:** Høy  
**Risikonivå:** Moderat  

**Mitigering:**
- Supabase backups
- Point-in-time restore
- Disaster Recovery Plan
- Logging via ops_events

**Status:** Akseptert med kontroll

---

## R-06: Infrastructure outage

**Beskrivelse:**  
Supabase eller Vercel utilgjengelig.

**Sannsynlighet:** Moderat  
**Konsekvens:** Moderat  
**Risikonivå:** Moderat  

**Mitigering:**
- Fail-closed design
- Monitoring
- Incident Response Plan
- Backup-strategi

**Status:** Akseptert risiko

---

## R-07: Orders table growth

**Beskrivelse:**  
Orders vokser og påvirker ytelse.

**Sannsynlighet:** Høy (over tid)  
**Konsekvens:** Moderat  
**Risikonivå:** Moderat  

**Mitigering:**
- Indekser
- Retention policy
- Partisjonering ved behov
- Monitoring

**Status:** Planlagt skalering

---

# 3️⃣ OPERASJONELLE RISIKOER

---

## R-08: Manuell overstyring i produksjon

**Beskrivelse:**  
Noen gjør manuell DB-endring.

**Sannsynlighet:** Lav  
**Konsekvens:** Høy  
**Risikonivå:** Moderat  

**Mitigering:**
- No-exception rule
- Logging policy
- Begrenset DB-tilgang

**Status:** Kontrollert

---

## R-09: Mangel på dokumentasjon

**Beskrivelse:**  
Arkitektur endres uten oppdatering av dokumenter.

**Sannsynlighet:** Moderat  
**Konsekvens:** Moderat  
**Risikonivå:** Moderat  

**Mitigering:**
- ADR-krav
- Dokumentpakke
- CI review

**Status:** Overvåkes

---

# 4️⃣ FORRETNINGSRISIKOER

---

## R-10: Avhengighet av tredjepartsleverandør

**Beskrivelse:**  
Sterk avhengighet av Supabase/Vercel.

**Sannsynlighet:** Moderat  
**Konsekvens:** Moderat  
**Risikonivå:** Moderat  

**Mitigering:**
- DR-plan
- Backup
- Region-strategi
- Portabilitet

**Status:** Akseptert

---

## R-11: Feil i avtalehåndtering

**Beskrivelse:**  
Feil ACTIVE agreement fører til produksjonsavvik.

**Sannsynlighet:** Lav  
**Konsekvens:** Høy  
**Risikonivå:** Moderat  

**Mitigering:**
- Partial unique index
- DB enforcement
- Superadmin-rutiner
- Logging

**Status:** Kontrollert

---

# 5️⃣ STRATEGISKE RISIKOER

---

## R-12: Skaleringspress før optimalisering

**Beskrivelse:**  
Rask vekst før teknisk optimalisering.

**Sannsynlighet:** Moderat  
**Konsekvens:** Moderat  
**Risikonivå:** Moderat  

**Mitigering:**
- SCALABILITY_MODEL.md
- Monitoring
- Planlagt partisjonering

**Status:** Planlagt

---

# 6️⃣ RISIKOOVERSIKT (SAMMENDRAG)

| Risiko-ID | Nivå | Status |
|------------|------|--------|
| R-01 | Moderat | Kontrollert |
| R-02 | Lav | Kontrollert |
| R-03 | Moderat | Overvåkes |
| R-04 | Moderat | Overvåkes |
| R-05 | Moderat | Kontrollert |
| R-06 | Moderat | Akseptert |
| R-07 | Moderat | Planlagt |
| R-08 | Moderat | Kontrollert |
| R-09 | Moderat | Overvåkes |
| R-10 | Moderat | Akseptert |
| R-11 | Moderat | Kontrollert |
| R-12 | Moderat | Planlagt |

---

# 7️⃣ OPPDATERINGSPROSEDYRE

Dette dokumentet skal oppdateres ved:

- Nye roller
- Nye skriveveier
- Endringer i service-role policy
- Nye integrasjoner
- Etter incident
- Årlig revisjon

---

# 8️⃣ KONKLUSJON

Lunchportalen opererer med:

- Identifiserte risikoer
- Dokumenterte mitigeringer
- Fail-closed arkitektur
- DB-first enforcement
- Streng CI-policy

Rest-risiko er akseptert og overvåket.

Risiko er styrt – ikke ignorert.
