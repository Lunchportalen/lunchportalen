# 🔐 LUNCHPORTALEN – SECURITY ARCHITECTURE

Dette dokumentet beskriver sikkerhetsarkitekturen i Lunchportalen.

Målet er:

- Én sannhetskilde
- Fail-closed system
- Ingen manuelle unntak
- Deterministiske operasjoner
- Full sporbarhet
- Multi-tenant isolasjon

Dette dokumentet er bindende for videre utvikling.

---

# 1️⃣ ARKITEKTURPRINSIPP

## 1.1 Fail-Closed

Hvis noe er uklart → systemet blokkerer.

- Mangler avtale → ingen bestilling
- Cut-off passert → ingen endring
- Rolle uklar → ingen tilgang
- Scope mangler → ingen lesing

Systemet skal aldri forsøke å “gjette”.

---

## 1.2 Én Sannhetskilde

- Database er fasit
- RLS håndhever tilgang
- RPC håndhever forretningslogikk
- API-ruter er kun transportlag

Ingen data skrives uten eksplisitt validering.

---

# 2️⃣ AUTENTISERING

## 2.1 Mekanisme

- Supabase Auth
- JWT-basert sesjon
- `auth.uid()` brukes i alle RLS-regler og RPC

## 2.2 Forbud

- Ingen rolle avgjøres kun i frontend
- Ingen tilgang basert på URL alene

---

# 3️⃣ AUTORISERING (ROLLEMODELL)

## Roller

- employee
- company_admin
- superadmin
- kitchen
- driver

## Regler

| Rolle | Kan lese | Kan skrive |
|--------|----------|-----------|
| employee | egen ordre | egen ordre (før cutoff) |
| company_admin | alle i eget firma | ingen ordre-endring |
| superadmin | global | via eksplisitt RPC |
| kitchen | scoped | ingen direkte writes |
| driver | scoped | ingen writes |

Alle writes krever eksplisitt server-RPC.

---

# 4️⃣ MULTI-TENANT ISOLASJON

## 4.1 Database-lås

Composite FK:

(company_id, location_id)
→ company_locations(company_id, id)

## 4.2 RLS

Orders, profiles og kritiske tabeller har Row-Level Security aktivert.

Ingen cross-tenant lesing er mulig uten superadmin.

---

# 5️⃣ ORDERS – KRITISK DOMENE

## 5.1 Tillatt skrivevei

Kun via:

- `lp_order_set`
- `lp_order_cancel`

## 5.2 Håndhevet på DB-nivå

- ACTIVE agreement kreves
- ACTIVE company kreves
- Cut-off 08:00 (Europe/Oslo)
- Én ordre per bruker per dag
- Ingen DELETE (kun CANCELLED status)

## 5.3 Forbud

- Direkte `.insert()/.update()` i API
- Service-role writes til `orders`

---

# 6️⃣ SERVICE ROLE POLICY

Service-role brukes kun til:

- cron-jobber
- system-motor
- superadmin-system
- migrasjoner

Ikke i:

- bruker-eksponerte API-ruter
- order-ruter
- kitchen-ruter uten scope

CI stopper brudd.

---

# 7️⃣ AGREEMENTS & COMPANY STATUS

- Maks 1 ACTIVE agreement per (company_id, location_id)
- Endringer kun via server-RPC
- Statusendringer logges i ops_events
- Company kan ikke være ACTIVE uten gyldig avtale

---

# 8️⃣ CUT-OFF & TIDSLOGIKK

- Cut-off 08:00 Europe/Oslo
- Samme-dag endringer stoppes etter cut-off
- Fremtidige datoer tillatt
- Historiske datoer blokkert

Håndheves på DB-nivå.

---

# 9️⃣ LOGGING & AUDIT

Alle kritiske endringer logges i:

`ops_events`

Inneholder:

- rid
- actor_user_id
- company_id
- payload
- event_type
- created_at

Ingen skjulte systemendringer.

---

# 🔟 CRON & SYSTEM-MOTOR

- Kjører med service-role
- Har eksplisitt secret (`SYSTEM_MOTOR_SECRET`)
- Kan ikke omgå forretningsregler
- Utfører kun planlagte operasjoner (cleanup, scheduler, etc.)

---

# 1️⃣1️⃣ IDPOTENS & DETERMINISME

- `UNIQUE(user_id, date)` sikrer idempotens
- RPC bruker `ON CONFLICT`
- Ingen dupliserte bestillinger mulig
- Avbestilling er deterministisk

---

# 1️⃣2️⃣ CI & HARDENING

CI verifiserer:

- Ingen direkte orders-writes
- Ingen uautorisert service-role
- Typecheck passerer
- Tenant-isolation test passerer
- Enterprise-build passerer

Build stopper ved brudd.

---

# 1️⃣3️⃣ TRUSSELMODELL

| Risiko | Tiltak |
|--------|--------|
| Cross-tenant access | Composite FK + RLS |
| Cut-off bypass | DB-level gate |
| Admin override | Policy blokkert |
| Service-role misuse | CI allowlist |
| Dupliserte ordre | UNIQUE constraint |
| Skjulte endringer | ops_events |

---

# 1️⃣4️⃣ ZERO-EXCEPTION POLICY

Lunchportalen opererer med:

- Ingen manuelle unntak
- Ingen “bare denne ene gangen”
- Ingen bypass i produksjon
- Ingen debug-RPCer i main branch

---

# 1️⃣5️⃣ ENTERPRISE COMPLIANCE

Arkitekturen er designet for:

- Revisjon
- Skalering (50 000+ firma)
- Multi-tenant sikkerhet
- Forutsigbar drift
- Lav operasjonell risiko

---

# 🧾 KONKLUSJON

Lunchportalen er bygget etter følgende sikkerhetsmodell:

- All forretningskritisk logikk håndheves i databasen.
- API-laget er transport, ikke autoritet.
- Service-role er isolert og kontrollert.
- Ingen direkte writes uten validering.
- Ingen unntak fra modellen.

Dette dokumentet skal oppdateres ved enhver endring som påvirker:

- Roller
- RLS
- RPC
- Service-role bruk
- Multi-tenant struktur
