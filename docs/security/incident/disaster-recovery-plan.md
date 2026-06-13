# 🔥 LUNCHPORTALEN – DISASTER RECOVERY PLAN (DRP)

Dette dokumentet beskriver hvordan Lunchportalen håndterer:

- Total systemfeil
- Datatap
- Infrastrukturbrudd
- Leverandørfeil (Supabase / Vercel / Sanity)
- Regionale avbrudd
- Sikkerhetsrelaterte nødsituasjoner

Målet er:

- Minimal nedetid
- Minimal datatap
- Kontrollert gjenoppretting
- Forutsigbar drift
- Ingen improvisasjon

---

# 1️⃣ DEFINISJONER

## RTO – Recovery Time Objective
Maksimal akseptabel nedetid.

## RPO – Recovery Point Objective
Maksimal akseptabel datatap (tid).

---

# 2️⃣ MÅLSETTINGER

| Scenario | RTO | RPO |
|----------|------|------|
| API-nedetid | < 60 min | 0–5 min |
| Database-feil | < 2 timer | < 5 min |
| Region-outage | < 4 timer | < 5 min |
| Total leverandørfeil | < 8 timer | < 15 min |

---

# 3️⃣ SYSTEMAVHENGIGHETER

Lunchportalen avhenger av:

- Supabase (Postgres + Auth)
- Vercel (hosting)
- Sanity (CMS)
- E-postleverandør

Ingen lokal on-prem komponent.

---

# 4️⃣ DISASTER SCENARIER

## 4.1 Supabase Database Corruption

### Risiko
- Datakorrupt orders
- Feil agreement-status
- Tenant-isolasjon kompromittert

### Tiltak

1. Isoler API (midlertidig fail-closed)
2. Aktiver Supabase point-in-time restore
3. Identifiser tidspunkt før korrupt hendelse
4. Restore til ny instans
5. Verifiser:
   - Tenant isolation
   - ACTIVE agreement-regler
   - Cut-off enforcement
6. Re-route app til ny instans
7. Dokumenter i `ops_events`

---

## 4.2 Supabase Full Outage

### Risiko
- API utilgjengelig
- Auth utilgjengelig

### Tiltak

1. Fail-closed (ingen writes)
2. Informer kunder om midlertidig nedetid
3. Overvåk leverandørstatus
4. Gjenopprett når Supabase er oppe
5. Verifiser system integrity

Ingen fallback med lokal lagring tillatt.

---

## 4.3 Vercel Outage

### Risiko
- UI utilgjengelig
- API utilgjengelig

### Tiltak

1. Ingen data endres
2. Overvåk leverandørstatus
3. Re-deploy ved behov
4. Verifiser build-integritet

---

## 4.4 Service-Role Key Leak

### Risiko
- Uautorisert DB-tilgang

### Umiddelbar respons

1. Roter `SUPABASE_SERVICE_ROLE_KEY`
2. Roter `SYSTEM_MOTOR_SECRET`
3. Deaktiver kompromitterte nøkler
4. Gjennomgå logs
5. Validér ingen uautorisert writes
6. Logg incident

---

## 4.5 Data Slettet ved Feil

### Risiko
- Utilsiktet sletting av rader

Tiltak:

1. Bruk Supabase backup
2. Restore til midlertidig instans
3. Identifiser berørte rader
4. Re-insert via kontrollert admin-RPC
5. Logg alle korrigeringer

Orders slettes normalt ikke (kun CANCELLED).

---

## 4.6 Infrastruktur Region Failure

### Risiko
- Hele regionen utilgjengelig

Tiltak (fremtidig opsjon):

- Re-deploy i alternativ region
- Restore DB backup
- Oppdatere DNS

---

# 5️⃣ DATA BACKUP STRATEGI

## 5.1 Supabase

- Daglige automatiske backups
- Point-in-time recovery
- Manuell snapshot før større endringer

## 5.2 Orders

- Ingen fysisk DELETE
- Historikk beholdes
- Arkivering kan eksporteres

---

# 6️⃣ GJENOPPRETTINGSSEKVENS

Standard DR-sekvens:

1. Identifiser problem
2. Isoler system (fail-closed)
3. Evaluer påvirkning
4. Restore eller patch
5. Verifiser:
   - Tenant-isolasjon
   - Agreement enforcement
   - Cut-off enforcement
6. Gjenåpne system
7. Dokumenter i incident-logg

---

# 7️⃣ VERIFISERING ETTER RESTORE

Etter enhver restore må følgende testes:

- `test:tenant`
- RPC order set/cancel
- ACTIVE agreement-sjekk
- Cut-off enforcement
- Snapshot generering
- CI preflight

Ingen produksjonsåpning før disse passerer.

---

# 8️⃣ KOMMUNIKASJONSPOLICY

Ved større incident:

- Informer berørte firma
- Gi estimerte tider
- Ingen spekulasjon
- Ingen manuelle workarounds

---

# 9️⃣ ØVELSER

Årlig DR-test:

- Simulert DB restore
- Simulert service-role leak
- Simulert region-outage
- Simulert agreement corruption

Dokumenter resultat.

---

# 🔟 FORBUDTE HANDLINGER

- Ingen manuell SQL-endring uten logging
- Ingen bypass av RLS
- Ingen midlertidig deaktivert cut-off
- Ingen admin override

---

# 1️⃣1️⃣ KONTINUERLIG FORBEDRING

Ved hver incident:

- Oppdater INCIDENT_RESPONSE_PLAN
- Oppdater THREAT_MODEL
- Oppdater SECURITY_ARCHITECTURE
- Oppdater denne DRP

---

# 1️⃣2️⃣ KONKLUSJON

Lunchportalen er designet for:

- Fail-closed drift
- Kontrollert gjenoppretting
- Minimal datatap
- Sporbar korrigering
- Ingen improvisasjon

Disaster recovery er ikke ad-hoc.
Det er en planlagt og dokumentert prosess.