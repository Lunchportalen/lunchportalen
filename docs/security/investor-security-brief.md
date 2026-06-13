# 🔐 LUNCHPORTALEN – INVESTOR SECURITY BRIEF

## Executive Summary

Lunchportalen er bygget som et deterministisk, database-first driftssystem
for firmalunsj – ikke som en tradisjonell webapp.

All forretningskritisk logikk håndheves i databasen.
Dette reduserer risiko, kompleksitet og operasjonell støy.

Sikkerhet er ikke et lag.
Det er arkitektur.

---

# 1️⃣ SECURITY BY DESIGN

Lunchportalen følger følgende prinsipper:

- Fail-closed system
- Én sannhetskilde (database)
- Ingen manuelle unntak
- Deterministiske operasjoner
- Multi-tenant isolasjon
- Minimal write surface

Dette betyr at:

- Ingen bestillinger kan opprettes uten aktiv avtale
- Ingen kan endre bestilling etter cut-off (08:00)
- Ingen admin kan overstyre ansattes bestillinger
- Ingen data kan lekke mellom firma

---

# 2️⃣ TEKNISK BESKYTTELSESMODELL

## Database-first enforcement

- Row Level Security (RLS)
- Composite tenant-lås
- RPC-only writes
- Idempotente operasjoner
- UNIQUE constraints

Forretningsregler håndheves i DB, ikke i frontend.

## Service-role kontroll

- Service-role kan kun brukes i isolerte systemruter
- CI-guard stopper misbruk
- Ingen direkte writes via API

## Logging & sporbarhet

- Alle kritiske endringer logges
- Full audit trail
- Ingen skjulte systemoperasjoner

---

# 3️⃣ GDPR & DATAHÅNDTERING

Roller:

- Kunde (firma) = behandlingsansvarlig
- Lunchportalen = databehandler

Persondata:

- Navn
- E-post
- Firma-tilknytning
- Bestillingsvalg

Ikke behandlet:

- Sensitive helseopplysninger (med mindre bruker selv legger inn tekst)
- Betalingskortdata
- Fødselsnummer

Tiltak:

- Dataminimering
- Retention-policy
- RLS-basert isolasjon
- Backup & restore-prosedyrer

---

# 4️⃣ RISIKOHÅNDTERING

Identifiserte risikoer:

- Cross-tenant data leak
- Service-role misuse
- Infrastruktur-outage
- Menneskelig kodefeil

Mitigering:

- CI-hardening
- Disaster Recovery Plan
- Incident Response Plan
- CodeX-policy
- Arkitektur-dokumentasjon

Risiko er styrt, ikke ignorert.

---

# 5️⃣ SCALABILITY & ROBUSTHET

Systemet er designet for:

- 50 000+ firma
- 10+ millioner ansatte
- 10–20 millioner+ orders årlig

Skaleringsstrategi:

- Indeksering
- Partisjonering ved behov
- Retention-policy
- Write-minimal design

Ingen arkitekturendring kreves for 50k firma.

---

# 6️⃣ OPERASJONELL STABILITET

Lunchportalen har:

- Disaster Recovery Plan
- Business Continuity Plan
- Threat Model
- Risk Register
- CI-gates som stopper sikkerhetsbrudd
- Hard-coded forbud mot manuelle unntak

Systemet kan:

- Stanse sikkert
- Gjenopprettes kontrollert
- Dokumentere alle hendelser

---

# 7️⃣ KONKURRANSEFORTRINN

Lunchportalen er ikke fleksibel på individnivå.

Dette er et bevisst valg.

Det gir:

- Lavere operasjonell risiko
- Høyere forutsigbarhet
- Redusert matsvinn
- Høyere switching cost
- Lav churn

Arkitekturen støtter forretningsmodellen.

---

# 8️⃣ VURDERING

Lunchportalen er:

- Teknisk moden
- Sikkerhetsmessig disiplinert
- Dokumentert på enterprise-nivå
- Reviderbar
- Skalerbar
- Bygget for kontroll

Systemet er ikke improvisert.
Det er designet.

---

# 9️⃣ KONKLUSJON FOR INVESTORER

Lunchportalen representerer:

- En standardisert, repeterbar SaaS-modell
- Lav operasjonell risiko
- Høy marginpotensial
- Skalerbar arkitektur
- Dokumentert sikkerhetsrammeverk

Teknisk fundament støtter aggressiv vekst uten arkitekturrisiko.

Security og struktur er konkurransefortrinn – ikke kostnad.
