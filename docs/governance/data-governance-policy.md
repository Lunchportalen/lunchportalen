# 📊 LUNCHPORTALEN – DATA GOVERNANCE POLICY

Dette dokumentet beskriver hvordan Lunchportalen håndterer:

- Dataklassifisering
- Dataintegritet
- Datatilgang
- Databevaring
- Databruk
- Datakvalitet
- Datakompatibilitet
- Datagjenoppretting

Målet er å sikre:

- Én sannhetskilde
- Sporbarhet
- Determinisme
- Multi-tenant isolasjon
- Compliance

---

# 1️⃣ PRINSIPPER

Lunchportalen følger:

1. Database-first enforcement
2. Least privilege
3. Fail-closed
4. No-exception rule
5. Dataminimering
6. Sporbarhet før fleksibilitet

Data skal aldri:

- Manipuleres manuelt uten logging
- Brukes uten formål
- Eksporteres uten kontroll
- Deles mellom tenants

---

# 2️⃣ DATAKLASSIFISERING

## 2.1 Public Data
- Markedsinnhold
- Ikke-sensitive systembeskrivelser

## 2.2 Internal Data
- Systemmetrikker
- Aggregerte KPI-er

## 2.3 Confidential Data
- Navn
- E-post
- Firma-tilknytning
- Bestillingsdata

## 2.4 Sensitive Data
Lunchportalen lagrer ikke:

- Fødselsnummer
- Helsejournaler
- Betalingskortdata
- Biometrisk informasjon

---

# 3️⃣ DATAEIER & ROLLER

| Rolle | Ansvar |
|--------|--------|
| Firma (kunde) | Behandlingsansvarlig |
| Lunchportalen | Databehandler |
| CTO | Teknisk datakontroll |
| Sikkerhetsansvarlig | Compliance |

---

# 4️⃣ DATA LIVSSYKLUS

## 4.1 Innsamling

- Kun nødvendige felt
- Ingen skjult datainnsamling
- Ingen tracking uten formål

---

## 4.2 Lagring

- Supabase Postgres
- RLS håndhever isolasjon
- Composite FK for tenant
- Indekser for konsistens

---

## 4.3 Bruk

Data brukes kun til:

- Bestillingsflyt
- Avtalevalidering
- Produksjonsgrunnlag
- ESG-rapportering
- Intern analyse

Data brukes ikke til:

- Profilering
- Salg til tredjepart
- Reklame

---

## 4.4 Oppbevaring (Retention)

Retention-policy:

- api_rate_events → 30 dager
- idempotency_keys → kort levetid
- ops_events → 180 dager
- orders → arkiveres ved behov

Ingen sletting uten logging.

---

## 4.5 Arkivering

Ved høy volum:

- Partisjonering
- Arkivering av historiske data
- Kontrollert eksport

---

## 4.6 Sletting

- Profil kan deaktiveres
- Data slettes kun via kontrollert prosess
- Ingen direkte DELETE i produksjon

---

# 5️⃣ DATAINTEGRITET

## 5.1 Determinisme

- UNIQUE(user_id, date)
- ACTIVE agreement gate
- Cut-off enforcement
- RPC-only writes

---

## 5.2 Konsistens

- Ingen alternative write-paths
- Ingen manuelle overstyringer
- All mutation logges

---

## 5.3 Audit

- ops_events registrerer kritiske endringer
- Endringer kan spores

---

# 6️⃣ DATAISOLASJON

Multi-tenant isolasjon sikres via:

- company_id
- location_id
- Composite FK
- RLS policies

Cross-tenant data er ikke mulig.

---

# 7️⃣ DATA TIL AI

AI kan kun bruke:

- Aggregert historisk ordredata
- Ikke-sensitive felt

AI kan ikke:

- Endre rådata
- Endre rettigheter
- Skape nye data uten logging

---

# 8️⃣ DATAEKSPORT

Tillatte eksportformer:

- CSV
- API
- ESG-rapport
- Administrativ eksport

Alle eksportoperasjoner:

- Logges
- Scope-valideres
- Tenant-isoleres

---

# 9️⃣ DATARISIKOER

| Risiko | Tiltak |
|--------|--------|
| Cross-tenant leak | RLS + Composite FK |
| Manuell manipulering | No DELETE + logging |
| Service-role misuse | CI guard |
| Ustrukturert eksport | Scope enforcement |
| AI-data misbruk | AI Risk Framework |

---

# 🔟 DATAKVALITET

Måles gjennom:

- Tenant-isolation test
- Cut-off enforcement test
- Agreement validation test
- Snapshot consistency test

Datakvalitet er arkitektur – ikke manuell prosess.

---

# 1️⃣1️⃣ OVERVÅKNING

Data governance overvåkes via:

- Executive Monitoring Dashboard
- ESG Dashboard
- Risk Register
- Compliance review

---

# 1️⃣2️⃣ KONKLUSJON

Lunchportalen håndterer data gjennom:

- Struktur
- Determinisme
- Isolasjon
- Logging
- Compliance

Data er ikke bare lagret.
Den er styrt.

Data governance er en del av arkitekturen.
