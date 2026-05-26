# 📈 LUNCHPORTALEN – SCALABILITY MODEL

Dette dokumentet beskriver hvordan Lunchportalen skalerer teknisk, operasjonelt og økonomisk.

Scope:
- 50 000+ firma
- 10 000 000+ ansatte
- 5–20 millioner+ ordre
- Daglig produksjonsflyt
- Multi-tenant isolasjon

---

# 1️⃣ SKALERINGSPRINSIPP

Lunchportalen er designet etter følgende prinsipper:

- Database-first enforcement
- Multi-tenant via company_id
- Fail-closed
- Idempotente operasjoner
- Write-path minimalisering
- Read-heavy optimalisering
- Event-basert logging

Systemet er ikke bygget som en markedsplass, men som et deterministisk driftssystem.

---

# 2️⃣ DATAKAPASITET

## 2.1 Forventet volum

Scenario: 50 000 firma × 200 ansatte = 10 000 000 profiler

Antatt bruk:
- 60% bestiller
- 3 dager per uke
- 48 aktive uker

→ Ca. 8–12 millioner orders per år

---

## 2.2 Tabellvekst

| Tabell | Vekst | Kommentar |
|--------|-------|-----------|
| profiles | Lineær (firma × ansatte) | Stabil |
| orders | Lineær (bruk × tid) | Største tabell |
| agreements | Lav | Få per firma |
| ops_events | Moderat | Driftshendelser |
| api_rate_events | Høy | Retention cleanup |
| kitchen_snapshots | Moderat | Snapshot per dag |

---

# 3️⃣ DATABASE SKALERING

## 3.1 Indeksering

Kritiske indekser:

- orders(company_id, date)
- orders(company_id, location_id, date)
- orders(user_id, date)
- profiles(company_id)
- agreements(company_id, status)

UNIQUE(user_id, date) sikrer idempotens.

---

## 3.2 Partisjonering

Når orders > 5M rader:

Anbefalt:
- RANGE partition på `date`
- Månedlig partisjonering
- Arkivering av historiske partisjoner

Fordeler:
- Raskere VACUUM
- Mindre indeks-bloat
- Effektiv historisk arkivering

---

## 3.3 Retention

Retention-policy:

- api_rate_events: 30 dager
- idempotency_keys: 1–7 dager
- ops_events: 180 dager
- gamle orders: arkiveres etter 12–24 mnd

---

# 4️⃣ APPLIKASJONSSKALERING

## 4.1 Next.js (Vercel)

- Serverless routes
- Edge caching på read-only ruter
- Statiske sider for markedsinnhold
- SSR for kritiske views

Skalerer automatisk med trafikk.

---

## 4.2 Supabase

- Postgres (vertikalt + horisontalt via read replicas)
- Connection pooling
- Indekserte spørringer
- RLS håndheves på DB-nivå

Ved høy last:
- Read replicas for kjøkken/dashboard
- Dedicated compute tier

---

# 5️⃣ WRITE PATH MINIMALISERING

Kun to primære write-paths for orders:

- lp_order_set
- lp_order_cancel

Dette gir:

- Lav write-kompleksitet
- Høy determinisme
- Enklere caching
- Lav race-condition risiko

---

# 6️⃣ PRODUKSJONSFLYT

## 6.1 Daglig toppbelastning

Peak-scenario:
- 08:00 cut-off
- Mange samtidige requests

Mitigering:

- DB-level cutoff enforcement
- UNIQUE constraint
- Idempotent RPC
- Indekser på company_id + date

Systemet er write-light og read-heavy.

---

# 7️⃣ CRON & SYSTEM MOTOR

System-motor håndterer:

- Cleanup
- Scheduler
- Visibility
- Outbox retry

Skalerer lineært og kan isoleres til egen compute.

---

# 8️⃣ MULTI-TENANT STRATEGI

Tenant-separasjon via:

- company_id
- location_id
- Composite FK
- RLS

Ingen fysisk sharding nødvendig før 100k+ firma.

Hvis nødvendig:
- Horizontal sharding per region
- Firma-baserte databaser

---

# 9️⃣ KOSTNADSSKALERING

## 9.1 Kostnadsdrivere

- Postgres storage (orders)
- Compute for peak (cutoff)
- Snapshot queries
- Rate logging

## 9.2 Optimalisering

- Partisjonering
- Retention
- Snapshot caching
- Read replica for kjøkken

---

# 🔟 FAIL-OVER & RESILIENS

Avhengigheter:

- Supabase
- Vercel
- Sanity

Mitigering:

- Health endpoints
- System visibility API
- Graceful degradation (read-only fallback)

---

# 1️⃣1️⃣ PERFORMANCE RISIKOER

| Risiko | Tiltak |
|--------|--------|
| Orders-table blir for stor | Partisjonering |
| Indeks-bloat | Autovacuum + monitoring |
| Cutoff-peak | Indekser + idempotens |
| Snapshot-spikes | Pre-calc snapshots |

---

# 1️⃣2️⃣ LONG-TERM SCALING PLAN

| Fase | Tiltak |
|------|--------|
| < 10k firma | Nåværende arkitektur holder |
| 10–50k firma | Optimalisering + retention |
| 50–100k firma | Partisjonering |
| 100k+ | Region-sharding |

---

# 1️⃣3️⃣ KONKLUSJON

Lunchportalen er bygget som et:

- Write-minimal system
- Deterministisk driftssystem
- Multi-tenant plattform
- DB-first sikkerhetsmodell

Systemet kan skaleres til 50 000+ firma uten arkitekturendring.

Største vekstdriver er orders-tabellen, som håndteres via:

- Indekser
- Retention
- Partisjonering

Skalering er planlagt, ikke improvisert.