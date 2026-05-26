# 🏢 LUNCHPORTALEN – BUSINESS CONTINUITY PLAN (BCP)

Dette dokumentet beskriver hvordan Lunchportalen opprettholder
forretningskontinuitet ved:

- Infrastrukturbrudd
- Databasenedetid
- Sikkerhetshendelser
- Leverandørfeil
- Intern feil
- Ekstern krise

Formålet er å sikre:

- Stabil levering til kunder
- Minimal forstyrrelse i produksjon
- Forutsigbar respons
- Ingen improviserte unntak
- Kontrollert gjenoppretting

---

# 1️⃣ OVERORDNET STRATEGI

Lunchportalen er bygget som:

- Fail-closed driftssystem
- Deterministisk plattform
- Database-first enforcement
- Ingen manuelle unntak

Kontinuitet sikres gjennom:

- Redundans
- Logging
- Backup
- Incident-plan
- Disaster Recovery Plan
- Tydelig rolle- og ansvarsfordeling

---

# 2️⃣ KRITISKE FUNKSJONER

Følgende funksjoner må opprettholdes eller gjenopprettes raskt:

1. Bestillingssystem (orders)
2. Avtalevalidering (agreements)
3. Kjøkkenoversikt (kitchen view)
4. Cut-off logikk
5. Tenant-isolasjon
6. Autentisering

---

# 3️⃣ FORRETNINGSKRITISKE TIDSPUNKT

## 3.1 08:00 Cut-off

Dette er høyeste risikoperiode.

Kontinuitetskrav:

- Bestillinger må enten:
  - fungere normalt
  - eller være tydelig blokkert

Ingen halvfunksjon.

---

## 3.2 Produksjonsvindu

Kjøkken må kunne hente:

- Snapshot eller aggregerte data
- Konsistent ordrestatus

---

# 4️⃣ SCENARIOER OG RESPONS

## 4.1 Infrastruktur-nedetid (Supabase/Vercel)

Tiltak:

1. Fail-closed (ingen nye writes)
2. Kommuniser tydelig status
3. Overvåk leverandør
4. Gjenopprett ved tilgjengelighet

Forretningskonsekvens:
- Midlertidig pause
- Ingen datatap

---

## 4.2 Database-korrupt data

Tiltak:

1. Isoler system
2. Restore via point-in-time backup
3. Verifiser tenant-isolasjon
4. Test RPC-flyt
5. Re-åpne system

---

## 4.3 Sikkerhetshendelse

Tiltak:

1. Roter secrets
2. Steng potensielle bakdører
3. Revider logs
4. Informer kunder ved behov
5. Oppdater dokumentasjon

---

## 4.4 Menneskelig feil

Tiltak:

- CI-guard stopper kode
- Preflight kreves før deploy
- Ingen manuelle DB-endringer uten logging

---

# 5️⃣ KONTINUITETSARKITEKTUR

Lunchportalen bruker:

- Supabase backup (daglig + point-in-time)
- Deterministiske RPCer
- Ingen direkte writes
- Snapshot-logikk for kjøkken
- Retention-policy

Systemet er designet for å:

- Stanse sikkert
- Gjenopprettes kontrollert
- Ikke tape data ved API-feil

---

# 6️⃣ KOMMUNIKASJON

Ved større hendelser:

Intern:

- Logg i ops_events
- Opprett incident-ticket
- Dokumenter root cause

Ekstern:

- Transparent informasjon
- Estimert gjenopprettingstid
- Ingen spekulasjon

---

# 7️⃣ ROLLER & ANSVAR

| Rolle | Ansvar |
|--------|--------|
| Teknisk ansvarlig | Isolere og rette feil |
| Drift | Overvåke og koordinere |
| Ledelse | Kommunisere strategisk |
| Superadmin | Verifisere data-integritet |

---

# 8️⃣ REDUNDANS & RESILIENS

Mulige fremtidige tiltak:

- Read replica for kjøkken
- Region failover
- Database partitionering
- Backup-eksport offline

---

# 9️⃣ TESTING AV KONTINUITET

Årlig gjennomgang:

- Simulert cut-off-feil
- Simulert database-restore
- Simulert service-role leak
- Simulert tenant-isolation breach

Dokumenter resultat.

---

# 🔟 FORBUDTE HANDLINGER

Under krise er følgende ikke tillatt:

- Midlertidig bypass av RLS
- Manuell oppretting av ordre uten RPC
- Admin override av bestillinger
- Midlertidig deaktivert cut-off

Systemet skal ikke improvisere.

---

# 1️⃣1️⃣ REST-RISIKO

Akseptert risiko:

- Midlertidig nedetid ved leverandør-outage
- Midlertidig utilgjengelighet ved restore
- Avhengighet av tredjeparts hosting

Mitigering:

- Planlagt respons
- Dokumenterte prosedyrer
- Fail-closed arkitektur

---

# 1️⃣2️⃣ KONKLUSJON

Lunchportalen er bygget for:

- Stabil drift
- Kontrollert stopp
- Rask gjenoppretting
- Ingen manuelle unntak
- Forutsigbar produksjonsflyt

Business continuity er ikke en reaksjon.
Det er en del av arkitekturen.
