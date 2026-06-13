# 🗺️ LUNCHPORTALEN – DATA FLOW DIAGRAM (DFD)

Dette dokumentet beskriver dataflyt og kontrollpunkter i Lunchportalen.
Det er en tekstbasert DFD som kan leses i repoet og brukes i revisjon.

Målet er å vise:

- Hvor data kommer inn
- Hvor data lagres
- Hvilke gates som håndhever regler
- Hvilke roller som kan lese/skrive
- Hvilke underleverandører som er i flyten

---

# 1️⃣ SYSTEMGRENSER (SCOPE)

## Interne komponenter
- Next.js app (UI + API routes)
- Supabase Auth
- Supabase Postgres (RLS + RPC + constraints)
- Sanity (innhold)
- E-post (SMTP via Nodemailer)
- Cron/System-motor (server-side)

## Eksterne parter
- Ansatt (employee)
- Firma-admin (company_admin)
- Superadmin
- Kjøkken (kitchen)
- Sjåfør (driver)

---

# 2️⃣ DATAOBJEKTER (HVA FLYTER)

- Identity/session: JWT, user_id
- Tenant: company_id, location_id
- Profiles: role, active, tenant-binding
- Agreements: tier, delivery_days, slot, status, starts_at/ends_at
- Orders: date, slot, status, note
- Ops events: rid, actor, event_type, payload
- Kitchen snapshots: stable_hash, totals, scope

---

# 3️⃣ HOVEDFLYT – REGISTRERING → AVTALE → BESTILLING → PRODUKSJON → LEVERING

## 3.1 Registrering (Firma) – “Onboarding Gate”
**Actor:** Firma-admin  
**Entry:** `/registrering` (gate)

Flow:

1. Firma-admin sender inn firmadata
2. Next API validerer input
3. DB skriver:
   - companies(status=PENDING)
   - company_locations
   - public_registration_log

**Gates:**
- Minimum 20 ansatte (registreringskrav)
- Fail-closed hvis mangler data

**Data stores:**
- `companies`
- `company_locations`
- `public_registration_log`

---

## 3.2 Invitasjon (Ansatt) – “Invite Gate”
**Actor:** Firma-admin  
**Entry:** Admin UI → invite

Flow:

1. Admin oppretter invite (email + location)
2. DB skriver:
   - employee_invites(token_hash, expires_at, status=PENDING)

**Gates:**
- Invite knyttes til company/location via composite FK
- Token har expiry

**Data stores:**
- `employee_invites`

---

## 3.3 Accept invite / Profile creation
**Actor:** Ansatt  
**Entry:** `/accept-invite`

Flow:

1. Ansatt autentiserer seg (Supabase Auth)
2. Server validerer token
3. DB skriver:
   - profiles(user_id, company_id, location_id, role=employee)

**Gates:**
- Token må være gyldig og ikke utløpt
- Profil er tenant-bound

**Data stores:**
- `auth.users`
- `profiles`
- `employee_invites`

---

## 3.4 Avtale – “Agreement Pending → Active”
**Actors:** Firma-admin + Superadmin  
**Entry:** Admin UI + Superadmin UI

Flow:

1. Firma-admin oppretter avtaleutkast → `agreements(status=PENDING)`
2. Superadmin godkjenner → `agreements(status=ACTIVE)`
3. Partial unique index sikrer:
   - maks 1 ACTIVE avtale per (company_id, location_id)

**Gates:**
- Statusmaskin (PENDING → ACTIVE)
- DB låser entydig avtalegrunnlag

**Data stores:**
- `agreements`
- `ops_events` (ved endring)

---

## 3.5 Bestilling (Ansatt) – “Orders Hard Gate”
**Actor:** Ansatt  
**Entry:** App UI → bestill

Flow (write):

1. UI kaller DB RPC:
   - `lp_order_set(date, slot, note)`
2. DB håndhever:
   - company ACTIVE
   - agreement ACTIVE + date within rules
   - delivery_days matcher ukedag
   - cut-off 08:00 Oslo
   - profil active og tenant match
3. DB upsert:
   - orders(user_id, date) (idempotent)
4. DB returnerer fasit-rad

**Gates:**
- RLS + RPC-only writes
- `REVOKE INSERT/UPDATE/DELETE` på `orders`
- `UNIQUE(user_id, date)` for idempotens

**Data stores:**
- `orders`
- `ops_events` (hvis aktiv logging på mutations)

---

## 3.6 Avbestilling (Ansatt) – “Cancel Hard Gate”
**Actor:** Ansatt  
**Entry:** App UI → avbestill

Flow:

1. UI kaller DB RPC:
   - `lp_order_cancel(date)`
2. DB håndhever:
   - cut-off 08:00 Oslo
   - profil + tenant match
   - company/ agreement active (hvis satt i gate)
3. DB setter:
   - status = CANCELLED

**Data stores:**
- `orders`

---

## 3.7 Kjøkken – “Production View”
**Actor:** Kitchen  
**Entry:** Kitchen UI / kitchen API

Flow (read):

1. Kitchen henter dagens ordre per slot
2. System leverer:
   - live query med indekser
   - eller kitchen_snapshots hvis aktivert

**Gates:**
- Role + scope (kitchen)
- Fail-closed dersom scope mangler

**Data stores:**
- `orders`
- `kitchen_snapshots`

---

## 3.8 Levering – “Driver View”
**Actor:** Driver  
**Entry:** Driver UI / driver API

Flow:

1. Driver henter leveringsliste (slot/location)
2. Kun read og scoped tilgang

**Data stores:**
- `orders`
- `company_locations`

---

# 4️⃣ CRON & SYSTEM MOTOR DATAFLOW

**Actor:** System motor (cron)  
**Entry:** `/api/cron/**` (service role)

Flow:

- Cleanup:
  - api_rate_events retention
  - idempotency_keys cleanup
  - ops_events retention
- System health snapshots / visibility
- Retry/outbox mechanisms

**Gates:**
- `SYSTEM_MOTOR_SECRET`
- Service role allowlist
- CI guard stopper service role utenfor cron/system

**Data stores:**
- `api_rate_events`
- `idempotency_keys`
- `ops_events`
- `system_health` / snapshots (hvis finnes)
- `kitchen_snapshots` (hvis generert)

---

# 5️⃣ UNDERLEVERANDØR-DATAFLYT

## Supabase
- Auth: user_id, session
- Database: orders, profiles, agreements
- RLS: enforcement
- Backups: PITR

## Vercel
- Hosting av Next.js
- API routes
- Build pipeline

## Sanity
- Weekplan / content
- Read-only i runtime (write token kun for admin/ops)

## E-post (SMTP)
- Password reset
- System notifications
- Optional backups/outbox

---

# 6️⃣ KONTROLLPUNKTER (GATES) – ENKEL FASIT

| Gate | Hvor | Formål |
|------|------|--------|
| Auth gate | Supabase Auth | Bekrefte identitet |
| Role gate | profiles.role + RLS | Hindre uautorisert tilgang |
| Tenant gate | company_id/location_id | Multi-tenant isolasjon |
| Agreement gate | lp_has_active_agreement | Ingen ordre uten avtale |
| Cut-off gate | lp_cutoff_ok | 08:00 Oslo enforcement |
| Idempotency gate | UNIQUE(user_id,date) | Ingen doble ordre |
| Service role gate | allowlist + CI | Ingen bypass |
| Logging gate | ops_events | Audit og sporbarhet |

---

# 7️⃣ “FAIL-CLOSED” VISNING

Hvis noen av disse er uklare:

- user session
- profile tenant-binding
- company status
- agreement status
- scope

→ systemet skal blokkere og gi tydelig feilkode.

Ingen stille feil.

---

# 8️⃣ DIAGRAM (TEKSTBASERT)

[Employee UI] --(JWT)--> [Next App] --(RPC)--> [Supabase DB]
| | |
| | +--> (RLS + Cutoff + Agreement)
| +--> [Supabase Auth]|
|
+--> read orders (RLS) --> [Supabase DB]

[Company Admin UI] ---> [Next App] ---> agreements(PENDING) ---> [DB]
[Superadmin UI] -----> [Next App] ---> agreements(ACTIVE) ----> [DB] -> ops_events

[Kitchen UI] ---- read ----> [Next App] ----> orders/snapshots ----> [DB]
[Driver UI] ----- read ----> [Next App] ----> routes/scope --------> [DB]

[Cron/System] (service role + secret) ---> cleanup/snapshots ---> [DB]


---

# 9️⃣ OPPDATERING

Oppdater dette dokumentet ved:

- nye roller
- nye kritiske tabeller
- nye write-paths
- endringer i RLS/RPC
- nye integrasjoner