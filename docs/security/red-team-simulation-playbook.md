# 🔥 LUNCHPORTALEN – RED TEAM SIMULATION PLAYBOOK

Dette dokumentet beskriver hvordan Lunchportalen gjennomfører
kontrollerte sikkerhetssimuleringer (Red Team-øvelser).

Formålet er å:

- Validere arkitekturen
- Teste faktiske kontroller
- Identifisere svakheter i praksis
- Trene teamet
- Forbedre respons

Red Team-øvelser er ikke penetrasjonstest alene.
De tester også organisasjon og prosess.

---

# 1️⃣ PRINSIPPER

- Ingen produksjonsdata kompromitteres
- Ingen destruktive tester uten godkjenning
- Fail-closed forventes
- All aktivitet logges
- Læring > skyld

---

# 2️⃣ ROLLER

| Rolle | Ansvar |
|--------|--------|
| Red Team Lead | Planlegger og gjennomfører simulering |
| Blue Team | Forsvarer og responderer |
| Observatør | Dokumenterer |
| CTO | Eier av øvelsen |
| Styre (valgfritt) | Får rapport |

---

# 3️⃣ TESTKATEGORIER

## 3.1 Tenant Isolation Attack

Mål:
Forsøke å lese data fra annet firma.

Metoder:
- Manipulere API-parametre
- Bytte company_id i request
- JWT-manipulasjon
- Forsøke direkte RLS-bypass

Forventet resultat:
- Blokkert
- Logget
- Ingen data lekket

---

## 3.2 Cut-Off Bypass

Mål:
Forsøke å endre ordre etter 08:00.

Metoder:
- Replay requests
- Manipulere klokkeslett
- Direkte DB-write (om mulig)
- Concurrent request storm

Forventet resultat:
- Blokkert av DB
- Ingen bypass mulig

---

## 3.3 Agreement Bypass

Mål:
Opprette ordre uten ACTIVE agreement.

Metoder:
- Manipulere status
- Race condition
- Midlertidig agreement change

Forventet resultat:
- Blokkert av DB-gate

---

## 3.4 Role Escalation

Mål:
Ansatt forsøker å bli admin.

Metoder:
- Manipulere role i payload
- Endre profile via API
- Exploit svak admin-rute

Forventet resultat:
- Blokkert
- Logget

---

## 3.5 Service-Role Misuse

Mål:
Finne rute som bruker service-role feil.

Metoder:
- Gjennomgang av API
- Analyse av build artifacts
- Forsøk på privileged endpoint

Forventet resultat:
- CI guard stopper brudd
- Ingen direkte writes

---

## 3.6 Snapshot Manipulation

Mål:
Endre kjøkkendata uten autorisasjon.

Metoder:
- Manipulere snapshot calls
- Replay snapshot-id
- Falsk batch-status

Forventet resultat:
- Scope-blokkering
- Ingen write

---

## 3.7 Denial of Service

Mål:
Teste stabilitet under peak.

Metoder:
- Høyfrekvente requests
- Cut-off concurrency
- Repeated login attempts

Forventet resultat:
- Rate limiting
- Stabil RPC

---

# 4️⃣ SIMULERINGSPROSESS

## Steg 1 – Planlegging

- Definer scope
- Definer tidsrom
- Definer test-tenant
- Informer relevant team

## Steg 2 – Gjennomføring

- Dokumenter alle forsøk
- Logg resultater
- Identifiser svakheter

## Steg 3 – Analyse

- Root cause
- Arkitekturbrudd?
- Policybrudd?
- CI-brudd?

## Steg 4 – Forbedring

- Patch
- Oppdater dokumentasjon
- Oppdater Risk Register
- Oppdater Threat Model

---

# 5️⃣ EVALUERINGSKRITERIER

Øvelsen er vellykket hvis:

- Ingen tenant-lekkasje
- Ingen cut-off bypass
- Ingen service-role exploit
- Ingen uautorisert write
- Alle hendelser logges
- Team responderer innen definert MTTD/MTTR

---

# 6️⃣ RAPPORTMAL

Etter øvelse skal følgende leveres:

1. Executive Summary
2. Test Scenario
3. Observasjoner
4. Sårbarheter (hvis noen)
5. Root cause
6. Tiltak
7. Oppdatert risikovurdering

---

# 7️⃣ ÅRLIG PLAN

Red Team-øvelse skal gjennomføres:

- Minimum 1 gang per år
- Etter større arkitekturendring
- Etter compliance-milestone
- Før større enterprise-avtale

---

# 8️⃣ MODENHETSMÅLING

Etter hver øvelse vurderes:

- Reaksjonstid
- Blokkeringsevne
- Logging-kvalitet
- Dokumentasjonsoppdatering
- Arkitekturstabilitet

---

# 🔟 FORBUD

Under Red Team-øvelse er det ikke tillatt å:

- Endre produksjonsdata uten logging
- Omgå RLS manuelt
- Gi midlertidige admin-privilegier
- Skjule funn

---

# 🧾 KONKLUSJON

Red Team-øvelser er en del av arkitekturen.

De bekrefter at:

- RLS fungerer
- RPC-only enforcement holder
- Cut-off er reell
- No-exception rule står
- Multi-tenant isolasjon er robust

Dette er en disiplin – ikke et engangstiltak.
