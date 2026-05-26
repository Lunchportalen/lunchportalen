# 🚨 LUNCHPORTALEN – INCIDENT RESPONSE PLAN

Dette dokumentet beskriver hvordan Lunchportalen håndterer:

- Sikkerhetshendelser
- Systemfeil
- Databrudd
- Driftsavvik
- Infrastrukturfeil
- Forretningskritiske hendelser

Målet er:

- Rask identifikasjon
- Rask isolering
- Minimal skade
- Full sporbarhet
- Forutsigbar gjenoppretting
- Ingen panikkbaserte manuelle unntak

---

# 1️⃣ DEFINISJON AV INCIDENT

En incident er enhver hendelse som:

- Påvirker tilgjengelighet
- Påvirker dataintegritet
- Påvirker sikkerhet
- Påvirker tenant-isolasjon
- Påvirker cutoff eller bestillingsflyt
- Påvirker produksjon/kjøkken

---

# 2️⃣ INCIDENT KATEGORIER

## 🟢 P3 – Lav alvorlighet
- UI-feil
- Ikke-kritisk API-feil
- Minor visningsproblem

## 🟡 P2 – Moderat
- Orders kan ikke opprettes
- Cut-off logikk feiler
- Snapshot genereres feil

## 🔴 P1 – Kritisk
- Cross-tenant data leak
- Uautorisert tilgang
- Datakorrupt ordre
- ACTIVE agreement bypass
- Service-role lekkasje
- Produksjon stopper

---

# 3️⃣ INCIDENT FLOW

## 3.1 Oppdagelse

Kan oppdages via:

- System visibility API
- Health endpoints
- CI alerts
- Kjøkkenrapport
- Kundehenvendelse
- Monitoring (Supabase/Vercel)

---

## 3.2 Umiddelbar handling

Ved P1:

1. Isoler påvirket område
2. Deaktiver relevant API-route hvis nødvendig
3. Pause system-motor hvis relevant
4. Logg hendelsen i `ops_events`

Ved P2:

1. Identifiser root cause
2. Midlertidig fail-closed
3. Forbered patch

---

# 4️⃣ FAIL-CLOSED STRATEGI

Lunchportalen skal alltid:

- Stoppe nye writes hvis noe er uklart
- Ikke forsøke “best effort”
- Ikke gjette state
- Ikke åpne unntak manuelt

Eksempel:

- Hvis ACTIVE agreement usikker → blokkér bestilling
- Hvis cutoff usikker → blokkér endring
- Hvis rolle usikker → blokkér tilgang

---

# 5️⃣ DATA INTEGRITY RESPONSE

Ved mistenkt datakorrupt ordre:

1. Identifiser berørte `company_id`
2. Kjør isolert SELECT for validering
3. Ikke gjør direkte DB-manipulasjon
4. Bruk dedikert admin-RPC for korrigering
5. Logg alle endringer i `ops_events`

---

# 6️⃣ SIKKERHETSHENDELSE

Ved mistanke om:

- Service-role lekkasje
- API-bypass
- Tenant leak
- Uautorisert tilgang

## Umiddelbare steg:

1. Roter `SUPABASE_SERVICE_ROLE_KEY`
2. Roter `SYSTEM_MOTOR_SECRET`
3. Gjennomgå CI-guard logs
4. Gjennomgå git commits
5. Identifiser endring som åpnet hull

---

# 7️⃣ INFRASTRUKTURFEIL

## Supabase outage
- API-ruter returnerer fail-closed
- UI viser “Service unavailable”
- Ingen fallback som skriver data lokalt

## Vercel outage
- Ingen data endres
- System står stille (ingen data taper seg)

---

# 8️⃣ KOMMUNIKASJON

## Intern

- Logg i `ops_events`
- Opprett issue med tag `incident`
- Dokumenter root cause
- Dokumenter tiltak

## Ekstern (ved P1)

- Transparent melding
- Ingen spekulasjon
- Ingen manuelle workaround
- Forklar gjenopprettingstid

---

# 9️⃣ ROOT CAUSE ANALYSE

Etter incident:

- Hva feilet?
- Hvorfor feilet det?
- Kunne CI stoppet det?
- Brøt det CODEX?
- Krever det endring i Security Architecture?
- Krever det endring i Threat Model?

Oppdater dokumentasjon ved behov.

---

# 🔟 FORBUDTE TILTAK

Følgende er aldri tillatt:

- Manuell DB-endring uten logging
- Midlertidig bypass av RLS
- Midlertidig deaktivering av cut-off
- Midlertidig “gi admin override”
- Å la feil “leve” frem til senere

---

# 1️⃣1️⃣ BACKUP & GJENOPPRETTING

Supabase håndterer:

- Daglig backup
- Point-in-time recovery

Ved kritisk datatap:

1. Isoler
2. Eksporter berørte rader
3. Bruk restore via Supabase
4. Valider tenant-isolasjon
5. Dokumenter

---

# 1️⃣2️⃣ TEST AV INCIDENT-PLAN

Årlig gjennomgang:

- Simulert cutoff-feil
- Simulert service-role leak
- Simulert tenant-isolation breach
- Simulert agreement corruption

Planen må kunne gjennomføres uten improvisasjon.

---

# 1️⃣3️⃣ SYSTEM-PRINSIPP

Lunchportalen skal aldri:

- Improvisere i produksjon
- Lage manuelle unntak
- Åpne bakdører
- Bypasse database-gates

Systemet skal:

- Stanse sikkert
- Gjenopprettes kontrollert
- Logge alt
- Forbli deterministisk

---

# 🧾 KONKLUSJON

Lunchportalen er designet for:

- Forutsigbar drift
- Sikker isolasjon
- Ingen manuelle unntak
- Reverserbar skade
- Revisjonsklar dokumentasjon

Ved incident er første prioritet:

1. Stoppe skade
2. Sikre integritet
3. Dokumentere
4. Lære
5. Forsterke systemet

Security er ikke et lag.
Det er en operasjonsmodell.