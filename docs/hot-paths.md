# Database hot paths — kjerne-domene (kode → Postgres)

**Rev:** A · **Dato:** 2026-05-18 · **Kilde:** `rg supabase.from(` / `rg supabase.rpc(` i `lib/` + `app/`, samt manuell gjennomgang av `app/api`-ruter for ordre, uke, kjøkken, sjåfør og admin-innsikt.

**Merk:** CMS/Sanity-kall er utelatt med mindre de er sekundære for raden. «Standing orders»-tabell finnes i DB og advisors; ingen direkte `from("standing_orders")` i `app/`/`lib/` TypeScript ved denne kartleggingen — fremtidige RPC eller migrerte baner kan legge til.

| Endepunkt / modul | Tabeller (typisk) | Typiske filtre | Mønstertype | Risiko @ 50K |
|-------------------|-------------------|----------------|-------------|--------------|
| `POST /api/orders` | Via RPC: `lp_order_set`, `lp_idem_begin`, `lp_idem_complete`, `lp_idem_fail`; lesing `orders` m.m. i samme flyt | `company_id`, bruker/dato/slot (innpackket i RPC), idempotency-nøkkel | Punkt-oppslag + transaksjon | **high** |
| `GET /api/orders/week` | `orders` (+ evt. kolonne-probing) | `company_id`, uke/dato-range | Scan / begrenset utvalg | **high** |
| `GET /api/orders/today` | `orders`, `companies` | `company_id`, `date`, status | Scan per dag + membership-sjekk | **high** |
| `GET /api/orders/my` | `orders`, `companies` | `company_id`, bruker-relevant utvalg | Scan / filter | **medium** |
| `PATCH /api/orders/choice` | `orders`, `companies` | `company_id`, aktiv ordre/dato | Punkt + oppdatering | **medium** |
| `GET /api/order/window` | `companies`, `orders`, `day_choices`, `company_current_agreement` (view) | `company_id`, service_date, timezone/window | Join-heavy / operative reads | **high** |
| `POST /api/order/bulk-set` | `companies`, `day_choices` | `company_id`, multi-dato bulk | Bulk skriving | **medium** |
| `POST /api/order/cancel` | `orders`, `profiles`, `day_choices` | `company_id`, bruker, dato/slot | Oppdatering + konsistens | **medium** |
| `GET /api/week` | `profiles`, `agreements` (+ CMS meny utenfor Postgres) | `user_id` → `company_id`, aktiv avtale | Punkt-oppslag + CMS-latency | **medium** (DB-delen: lav–medium) |
| `GET /api/kitchen` | `orders`, `companies`, `company_locations`, `profiles` | `service_date`, sets av `company_id` / `location_id` / `user_id` | Join-heavy batch | **high** |
| `GET /api/kitchen/company` | `orders`, `profiles`, `company_locations`, `kitchen_batches` | `company_id`, dato | Join-heavy | **high** |
| `GET /api/kitchen/companies` | `orders`, `companies`, `kitchen_batches` | Dato, aggregert liste | Aggregat / multi-get | **high** |
| `POST /api/kitchen/batch/start` (representerer batch-flyt) | `kitchen_batch` (batch-tabell), `kitchen_batches` brukes i andre kjøkken-visninger, `orders`, `company_locations`, `company_current_agreement` | `company_id`, `location_id`, dato | Transaksjonell batch | **high** |
| `GET /api/driver/stops` | `companies`, `company_locations`, `kitchen_batches`, (+ orden-levering) | Dato, lokasjonssett | Join-heavy, sortering | **high** |
| `GET /api/driver/today` | `company_locations`, `companies`, leveranser / batches (var.) | Dagens rute | Aggregat liste | **medium** |
| `GET /api/driver/orders` | `orders` | Sjåfør-scope, dato | Scan | **medium** |
| `GET /api/admin/insights` | `orders`, `profiles` | `company_id`, tidsintervall | Aggregater / GROUP BY | **high** |
| `GET /api/admin/dashboard` | `profiles`, `orders`, `companies` | `company_id`, `date` / uke-range, status | Flere `count` head-requests | **medium** |
| `lib/auth/membershipLookup.ts` | RPC `lp_membership_get`; ev. `profiles` | `user_id` | Punkt (kalles ofte) | **high** (frekvens) |
| `lib/auth/getScopeServer.ts` / `lib/auth/scope.ts` | `companies`, `agreements` | `company_id`, avtalestatus | Punkt | **medium** |
| `lib/auth/agreementStatus.ts` | `company_current_agreement`, `agreement_delivery_days`, `company_billing_accounts` | `company_id` | Punkt / lite join | **medium** |
| `POST /api/accept-invite/complete` | Invitasjoner, `profiles`, medlemskap-tabeller (flyt-avhengig) | E-post/token | Multi-steg transaksjon | **medium** |

## Dekningsgrad

- `supabase.from(` i `lib/` + `app/`: **163** matcher (linjer); `supabase.rpc(`: **6** linjer — høy overflate; denne tabellen er **prioritert subset** (ca. 22 rader).
- `app/api/**/route.ts`: **~581** filer — ikke alt er domene-kritiske for lunsj-operativ drift.

## Neste steg (utenfor Rev A)

- Valider plan og indeksbruk for radene merket **high** på **staging** med realistisk volum (`performance-p-backlog.md` P3).
