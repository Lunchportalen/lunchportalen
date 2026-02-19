# Ã°Å¸â€ºÂ¡ LUNCHPORTALEN Ã¢â‚¬â€œ THREAT MODEL

Dette dokumentet beskriver trusselbildet for Lunchportalen og hvordan systemet mitigere risiko.

Scope:
- Webapplikasjon (Next.js)
- Supabase (Auth + Postgres + RLS)
- Sanity (innholdsplattform)
- Service-role operasjoner
- Cron/system-motor
- Multi-tenant B2B-modell

---

# 1Ã¯Â¸ÂÃ¢Æ’Â£ SYSTEMKONTEKST

Lunchportalen er et multi-tenant driftssystem for firmalunsj.

Kritiske verdier:

- Bestillinger (orders)
- Avtaler (agreements)
- Firma-status
- Brukerprofiler
- Produksjonsdata (kitchen_snapshots)
- Driftshendelser (ops_events)

Systemet er bygget etter:

- Fail-closed prinsipp
- Ãƒâ€°n sannhetskilde (database)
- No-exception rule
- Deterministiske operasjoner
- RLS-basert tilgangskontroll

---

# 2Ã¯Â¸ÂÃ¢Æ’Â£ TRUSSELKATEGORIER

## 2.1 Uautorisert tilgang (Authentication bypass)

### Trussel
En bruker fÃƒÂ¥r tilgang til data uten gyldig sesjon.

### Tiltak
- Supabase Auth (JWT)
- `auth.uid()` brukes i RLS og RPC
- Ingen rolle bestemmes i frontend
- RLS aktivert pÃƒÂ¥ kritiske tabeller

RisikonivÃƒÂ¥: Lav

---

## 2.2 Cross-tenant data leak

### Trussel
En bruker ser data fra annet firma.

### Tiltak
- Composite FK (company_id, location_id)
- RLS pÃƒÂ¥ `orders`, `profiles`
- Tenant-isolation test i CI
- Ingen globale SELECT uten rolle-sjekk

RisikonivÃƒÂ¥: Lav

---

## 2.3 Bypass av cut-off (08:00)

### Trussel
Bruker endrer bestilling etter cut-off.

### Tiltak
- Cut-off logikk implementert i DB-funksjon (`lp_cutoff_ok`)
- RLS + RPC validerer cutoff
- Ingen direkte writes

RisikonivÃƒÂ¥: Lav

---

## 2.4 Bestilling uten aktiv avtale

### Trussel
Ordre opprettes uten ACTIVE agreement.

### Tiltak
- `lp_has_active_agreement`
- `lp_order_write_allowed`
- Partial unique: maks 1 ACTIVE agreement per lokasjon
- DB-level enforcement

RisikonivÃƒÂ¥: Lav

---

## 2.5 Service-role misbruk

### Trussel
Service-role brukes i feil kontekst og omgÃƒÂ¥r sikkerhetsregler.

### Tiltak
- CI-guard for SUPABASE_SERVICE_ROLE_KEY
- Allowlist (cron/system/superadmin)
- Forbud mot direkte writes i API
- Repo-wide sÃƒÂ¸k stopper brudd

RisikonivÃƒÂ¥: Moderat (hÃƒÂ¥ndteres via CI og policy)

---

## 2.6 Direkte database-writes via API

### Trussel
API-rute skriver direkte til kritiske tabeller.

### Tiltak
- RPC-only writes for `orders`
- REVOKE INSERT/UPDATE/DELETE
- CI gate stopper `.from("orders").<write>`
- Security Architecture policy

RisikonivÃƒÂ¥: Lav

---

## 2.7 Privilege escalation (rolle-eskalering)

### Trussel
En bruker fÃƒÂ¥r hÃƒÂ¸yere rolle enn tiltenkt.

### Tiltak
- Rolle lagret i DB (`profiles.role`)
- RLS validerer rolle
- Ingen rolle styrt av frontend
- Superadmin-endringer logges

RisikonivÃƒÂ¥: Lav

---

## 2.8 Replay / Idempotens-angrep

### Trussel
Dupliserte requests skaper flere ordre.

### Tiltak
- UNIQUE(user_id, date)
- `ON CONFLICT` i RPC
- idempotency_keys for kritiske operasjoner

RisikonivÃƒÂ¥: Lav

---

## 2.9 Driftssystem-bypass via cron

### Trussel
Cron kjÃƒÂ¸rer operasjoner som omgÃƒÂ¥r regler.

### Tiltak
- Cron isolert i `app/api/cron`
- Service-role kun der
- SYSTEM_MOTOR_SECRET kreves
- Ingen ordre-mutasjon uten agreement/cutoff-gate

RisikonivÃƒÂ¥: Lav

---

## 2.10 SQL injection / API injection

### Trussel
Bruker injiserer skadelig input.

### Tiltak
- Supabase query builder
- Ingen raw SQL i API
- RPC parametere typed
- TypeScript typecheck i CI

RisikonivÃƒÂ¥: Lav

---

## 2.11 Denial of Service

### Trussel
Spam av API for ÃƒÂ¥ overbelaste system.

### Tiltak
- api_rate_events logging
- Rate-limit struktur
- Cron-cleanup
- Infrastruktur-skalering (Vercel/Supabase)

RisikonivÃƒÂ¥: Moderat

---

# 3Ã¯Â¸ÂÃ¢Æ’Â£ SYSTEMISKE RISIKOER

## 3.1 Developer bypass
En utvikler legger inn midlertidig bypass i kode.

Tiltak:
- CI guard
- CODEX policy
- AGENTS.md
- CODEX_CHECKLIST fÃƒÂ¸r merge

---

## 3.2 Manuelle inngrep i produksjon
Noen gjÃƒÂ¸r direkte DB-endringer.

Tiltak:
- Ingen DELETE i orders
- Logging via ops_events
- No-exception policy

---

## 3.3 Uklare feil
System returnerer Ã¢â‚¬Å“OKÃ¢â‚¬Â uten ÃƒÂ¥ ha skrevet data.

Tiltak:
- Deterministiske RPC-svar
- Strukturert feilkode
- Rid + timestamp
- Outbox + retry mekanisme

---

# 4Ã¯Â¸ÂÃ¢Æ’Â£ GJENSTÃƒâ€¦ENDE RISIKOER

Ingen system er risikofritt.

Akseptert risiko:

- Infrastruktur-nedetid (leverandÃƒÂ¸ravhengighet)
- Supabase outage
- Vercel outage
- Sanity outage

Mitigering:
- Health routes
- System visibility API
- Graceful degradation

---

# 5Ã¯Â¸ÂÃ¢Æ’Â£ RISIKOMATRICE

| Trussel | Sannsynlighet | Konsekvens | Risiko |
|----------|---------------|------------|--------|
| Cross-tenant leak | Lav | HÃƒÂ¸y | Lav |
| Cut-off bypass | Lav | Middels | Lav |
| Service-role misuse | Moderat | HÃƒÂ¸y | Moderat |
| SQL injection | Lav | HÃƒÂ¸y | Lav |
| Replay | Lav | Lav | Lav |
| Cron misbruk | Lav | Middels | Lav |

---

# 6Ã¯Â¸ÂÃ¢Æ’Â£ OVERORDNET KONKLUSJON

Lunchportalen er designet etter:

- DB-level enforcement
- Role-based RLS
- RPC-only writes
- Deterministisk drift
- No-exception modell

De stÃƒÂ¸rste risikoene er:

- Menneskelig feil (kodeendringer som bryter policy)
- Feil bruk av service-role

Disse mitigere via:

- CI guard
- CODEX
- Security Architecture
- Hard RLS
- Preflight og enterprise build

---

# 7Ã¯Â¸ÂÃ¢Æ’Â£ OPPDATERING AV TRUSSELMODELL

Dette dokumentet skal oppdateres ved:

- Nye roller
- Nye mutasjoner
- Nye API-ruter
- Endringer i RLS
- Endringer i service-role policy
- Nye integrasjoner

---

# Ã°Å¸Â§Â¾ SLUTTORD

Security er ikke et lag Ã¢â‚¬â€œ det er arkitektur.

Lunchportalen hÃƒÂ¥ndhever sikkerhet i databasen, ikke i UI.
Systemet er designet for ÃƒÂ¥ vÃƒÂ¦re forutsigbart, reviderbart og skalerbart.

Dette dokumentet representerer gjeldende sikkerhetsvurdering per versjon.

