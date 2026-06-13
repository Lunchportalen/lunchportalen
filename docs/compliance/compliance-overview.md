# ⚖️ LUNCHPORTALEN – COMPLIANCE OVERVIEW

Dette dokumentet beskriver hvordan Lunchportalen etterlever relevante
regelverk og krav til:

- Personvern (GDPR)
- Databehandling
- Informasjonssikkerhet
- Tilgangsstyring
- Sporbarhet
- Driftssikkerhet

Dette dokumentet gjelder per nåværende versjon.

---

# 1️⃣ ROLLER ETTER GDPR

## 1.1 Behandlingsansvarlig

Firmaet (kunden) er behandlingsansvarlig for:

- Ansattdata
- Bestillingsvalg
- Kostpreferanser
- Intern brukerkonto-administrasjon

## 1.2 Databehandler

Lunchportalen er databehandler for:

- Lagring av bestillinger
- Brukerprofiler
- Avtaleinformasjon
- Produksjonsdata

## 1.3 Underleverandører

- Supabase (database, auth)
- Vercel (hosting)
- Sanity (innhold)
- E-postleverandør

Alle underleverandører skal ha:

- DPA (Data Processing Agreement)
- Databehandling innenfor EU/EØS (der relevant)

---

# 2️⃣ BEHANDLET PERSONDATA

Lunchportalen behandler:

| Datatype | Formål |
|----------|--------|
| Navn | Identifikasjon |
| E-post | Pålogging / varsling |
| Firma-tilknytning | Multi-tenant isolasjon |
| Bestillingsvalg | Produksjon |
| Eventuelle notater | Levering |

Lunchportalen behandler ikke:

- Fødselsnummer
- Sensitive helseopplysninger (med mindre eksplisitt skrevet av bruker)
- Betalingskortdata

---

# 3️⃣ DATAMINIMERING

Systemet er designet for å:

- Lagre kun nødvendige felter
- Ikke lagre unødvendig metadata
- Ikke lagre IP-adresser som standard
- Ikke lagre sensitive data uten eksplisitt brukerinput

Retention-policy:

- Rate logs: 30 dager
- Idempotency keys: kort levetid
- Ops-events: begrenset historikk
- Orders kan arkiveres etter behov

---

# 4️⃣ TILGANGSSTYRING

## 4.1 Autentisering

- Supabase Auth
- JWT-baserte tokens
- Ingen rolle lagret i frontend

## 4.2 Autorisering

- RLS (Row Level Security)
- Rollebasert tilgang
- Multi-tenant via company_id

## 4.3 Rollebegrensning

| Rolle | Tilgang |
|--------|--------|
| employee | Kun egen ordre |
| company_admin | Kun eget firma |
| superadmin | Systemnivå |
| kitchen | Scoped |
| driver | Scoped |

---

# 5️⃣ SIKKERHETSTILTAK

## 5.1 Database

- RLS aktivert
- Composite FK for tenant-isolasjon
- Ingen direkte writes
- RPC-only mutations

## 5.2 Infrastruktur

- HTTPS (TLS)
- Secrets lagret i GitHub/Vercel
- Service-role allowlist
- CI hardening

## 5.3 Logging

- Alle kritiske hendelser logges i `ops_events`
- Endringer er sporbare
- Ingen skjulte systemoperasjoner

---

# 6️⃣ RETTIGHETER FOR REGISTRERTE (GDPR)

Lunchportalen støtter:

- Innsyn (data kan eksporteres)
- Retting (via admin)
- Sletting (profil kan deaktiveres)
- Begrensning (firma kan pauses)
- Dataportabilitet (eksport via DB)

Forespørsler håndteres av behandlingsansvarlig (firma).

---

# 7️⃣ DATABRUDD

Ved databrudd:

- Incident Response Plan aktiveres
- Rotering av secrets
- Identifisering av berørte firma
- Varsling innen 72 timer (ved reell risiko)

---

# 8️⃣ DATAOPPBEVARING

Orders og profiler lagres så lenge:

- Firma har aktiv avtale
- Eller i henhold til kontrakt

Historiske data kan arkiveres.

Ingen data brukes til:

- Markedsføring uten samtykke
- Profilering
- Tredjeparts deling

---

# 9️⃣ SAMTYKKE

- Ansatt registreres via firma
- Firma er behandlingsansvarlig
- Systemet krever ikke eksplisitt samtykke for kjernefunksjon
- Eventuelle tilleggsfunksjoner krever eksplisitt valg

---

# 🔟 INTERN KONTROLL

Lunchportalen har:

- CODEX-policy
- CI guard
- RLS enforcement
- Dokumentert arkitektur
- Incident Response Plan
- Threat Model
- Scalability Model

Sikkerhet er arkitektur, ikke tillegg.

---

# 1️⃣1️⃣ VURDERING AV REST-RISIKO

| Risiko | Tiltak | Status |
|--------|--------|--------|
| Cross-tenant leak | RLS + FK | Lav |
| Cutoff bypass | DB enforcement | Lav |
| Service-role misuse | CI + allowlist | Moderat |
| Menneskelig feil | CODEX + CI | Moderat |
| Infrastruktur-outage | Fail-closed | Moderat |

---

# 1️⃣2️⃣ KONKLUSJON

Lunchportalen er designet med:

- Privacy by Design
- Security by Default
- Fail-Closed arkitektur
- Deterministisk databehandling
- Minimal dataeksponering

Systemet er forberedt for:

- Enterprise revisjon
- GDPR vurdering
- Konsernsalg
- Teknisk due diligence

Eventuelle endringer i:

- Datamodell
- Rollemodell
- RLS
- Service-role policy
- Logging

må føre til oppdatering av dette dokumentet.