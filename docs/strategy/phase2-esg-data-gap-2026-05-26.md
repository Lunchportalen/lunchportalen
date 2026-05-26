# Phase 2 — ESG Data Gap Analysis

**Date:** 2026-05-26  
**Mode:** READ-ONLY · Supabase migrations + Sanity schema crawl  
**Cross-ref:** [ESG Engine Design Phase 1](./esg-engine-design-2026-05-26.md) · [Phase 2 AI inventory](./phase2-ai-inventory-2026-05-26.md)

---

## B.1 Supabase schema — relevant tables

### Authoritative order model

| Table | Role | ESG-relevant columns |
|-------|------|---------------------|
| **`orders`** | 1 order / user / day | `date`, `status` (`ACTIVE` \| `CANCELLED`), `company_id`, `location_id`, `slot`, timestamps |
| **`day_choices`** | Meal choice per user/day | `choice_key`, `status` (`ACTIVE` \| `CANCELLED`), `company_id`, `location_id`, `date` |
| **`companies`** | Tenant | `name`, `orgnr`, `employee_count`, `address`, `agreement_json` |
| **`company_locations`** | Delivery site | `name`, `address`, `slot_policy`, `status` |
| **`kitchen_batches`** | Batch status | `delivery_date`, `delivery_window`, `status` (`QUEUED`/`PACKED`/`DELIVERED`) — **no quantity** |
| **`production_operative_snapshots`** | Frozen order-id set | `delivery_date`, `company_id`, `order_ids` (json) — operative truth, not ESG rollup |

**Not found in git migrations:** `order_lines`, `order_items`, `menu_items` (Postgres). Menu truth lives in **Sanity** (`menuDay`), linked at runtime via `choice_key` / Sanity menu lookup — not persisted as CO₂-bearing rows in Supabase.

### ESG tables — historical vs prod

| Table | In git history | Prod state (K4) |
|-------|----------------|-----------------|
| **`esg_monthly`** | Created in `20260218_*`, `20260221_*` with `waste_estimate_kg`, `co2_estimate_kg`, `delivered_*`, `cancelled_*` | **DROPPED** — `20260522160000_k4_kill_esg_tables.sql` |
| **`esg_daily`** | Indexed in `20260330000000_fk_support_indexes.sql` | **DROPPED** (same migration) |

**Implication:** ESG rollups must be **re-designed and re-migrated** — Phase 1 design doc remains valid; DB is empty of ESG aggregates.

### Logistics / distance

| Asset | Status |
|-------|--------|
| **`deliveries`**, **`driver_runs`** | Referenced in RLS drift capture (`20260517000000_capture_prod_rls_drift.sql`) — **no `CREATE TABLE` in tracked migrations** |
| Route distance / km | **Not found** in any migration grep (`km`, `distance`, `latitude`, `longitude`) |

---

## B.2 Metric-by-metric gap matrix

### 1. kg matsvinn unngått (avoided waste)

| Dimension | FINNES | MANGLER |
|-----------|--------|---------|
| **Cancellation signal** | ✅ `orders.status`, `day_choices.status`, `demandData.isCancelledBeforeOsloCutoff()` | — |
| **Portion weight** | ❌ | No `portion_weight_kg` on order or menu |
| **Produced volume** | ❌ | `wasteTracker` requires `produced` — always `null` in `demand-insights` |
| **Avoided kg formula** | ⚠️ Concept in `docs/strategy/frameworks/esg-kpi-framework.md` + Phase 1 design | No `order_lifecycle` or rollup job |

**Current code path:** `app/api/admin/demand-insights` maps `consumed: h.activeCount`, `produced: null` → waste rollup returns *"Ingen registrert produksjon"*.

**Migration sketch (READ-ONLY proposal):**

```sql
-- DC-ESG-101: order lifecycle events (idempotent)
create table public.order_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  company_id uuid not null references public.companies(id),
  event_type text not null check (event_type in (
    'BOOKED','CANCELLED_IN_TIME','CANCELLED_LATE','CONSUMED','NOSHOW'
  )),
  event_at timestamptz not null default now(),
  portion_weight_kg numeric(8,3),  -- snapshot at event time
  emission_factor_id uuid null       -- FK when emission_factors exists
);
create index order_lifecycle_events_company_date_idx
  on public.order_lifecycle_events (company_id, event_at);
```

---

### 2. CO₂e per lunsj

| Dimension | FINNES | MANGLER |
|-----------|--------|---------|
| **Order counts** | ✅ | — |
| **Menu category** | ⚠️ Sanity `menuDay.category`, `isFishDish`, `isVegetarian` | No Postgres mirror |
| **Emission factor per dish** | ❌ | No `emission_factors` table (Phase 1 DC-100) |
| **CO₂e on order** | ❌ | No computed column or rollup |

**Sanity gap:** `menuDay` has `nutritionPer100g`, allergens, `kitchenStyle`, `costTier` — **no `co2ePerPortion`, `origin`, `organicPct`**.

**Migration sketch:**

```sql
-- DC-ESG-100: emission factor catalog
create table public.emission_factors (
  id uuid primary key default gen_random_uuid(),
  category_code text not null unique,  -- beef, chicken, vegetarian, fish, vegan
  kg_co2e_per_kg numeric(10,4) not null,
  kg_co2e_per_portion_default numeric(10,4) not null,
  portion_weight_kg_default numeric(8,3) not null default 0.400,
  source text not null,              -- 'RISE_NO', 'EAT_LANCET', 'NORSUS'
  source_version text not null,
  valid_from date not null default current_date,
  constraint emission_factors_positive check (kg_co2e_per_kg >= 0)
);

-- DC-ESG-102: monthly tenant rollup (replaces killed esg_monthly)
create table public.esg_tenant_monthly (
  company_id uuid not null references public.companies(id),
  month date not null check (month = date_trunc('month', month)::date),
  meals_delivered int not null default 0,
  meals_cancelled_in_time int not null default 0,
  kg_food_avoided numeric(16,4) not null default 0,
  kg_co2e_avoided numeric(16,4) not null default 0,
  methodology_version text not null,
  computed_at timestamptz not null default now(),
  primary key (company_id, month)
);
```

---

### 3. km kjørt per bedrift

| Dimension | FINNES | MANGLER |
|-----------|--------|---------|
| **Delivery stops** | ⚠️ `deliveries` (prod RLS only) | No distance columns in git |
| **Geocoding** | ⚠️ `companies.address`, `company_locations.address` (text) | No lat/lon |
| **Route optimization data** | ❌ | No `route_legs`, `distance_km` |

**Migration sketch:**

```sql
-- DC-ESG-103: delivery leg metrics (when deliveries schema confirmed)
alter table public.deliveries add column if not exists
  distance_km numeric(10,2),
  route_sequence int,
  geocode_source text;
-- Requires prod schema audit before apply
```

**Status:** **Blocked** — confirm `deliveries` DDL from prod/staging before migration.

---

### 4. % lokal-sourcet ingredienser

| Dimension | FINNES | MANGLER |
|-----------|--------|---------|
| **Ingredient provenance** | ❌ Sanity | No `originRegion`, `localSourced`, `organic` on `menuDay` / `mealIdea` |
| **Supplier metadata** | ⚠️ Sanity `provider` document | No ESG fields audited |

**Sanity extension sketch (not implemented):**

```typescript
// menuDay.ts — proposed fields
defineField({ name: "localSourcedPct", type: "number", validation: Rule => Rule.min(0).max(100) }),
defineField({ name: "originCountry", type: "string", options: { list: ["NO", "EU", "GLOBAL"] } }),
defineField({ name: "organicPct", type: "number" }),
```

**Status:** **Ikke startet** — narrative-only today.

---

### 5. kg restmat redistribuert

| Dimension | FINNES | MANGLER |
|-----------|--------|---------|
| **Leftover registration** | ⚠️ `wasteTracker.leftover` computed if `produced` + `consumed` known | No kitchen input UI → DB |
| **Redistribution log** | ❌ | No `food_recovery_events` table |
| **Partner / charity flow** | ❌ | Product not built |

**Migration sketch:**

```sql
-- DC-ESG-104: kitchen production + recovery
create table public.kitchen_production_daily (
  company_location_id uuid not null references public.company_locations(id),
  production_date date not null,
  portions_produced int not null,
  portions_consumed int not null,
  kg_leftover numeric(12,3) not null default 0,
  kg_redistributed numeric(12,3) not null default 0,
  primary key (company_location_id, production_date)
);
```

---

## B.3 Sanity schema audit (ingredient / ESG metadata)

| Document | ESG-relevant fields present | Missing for ESG engine |
|----------|----------------------------|------------------------|
| **`menuDay`** | `nutritionPer100g`, allergens, `isVegetarian`, `isFishDish`, `kitchenStyle`, `costTier` | CO₂e, origin, organic %, local %, portion weight |
| **`mealIdea`** | (base bank — not fully crawled) | Likely same gaps |
| **`dish`** | `title`, `allergens`, `tags` | All ESG fields |
| **`provider`** | Name/slug | Supplier ESG cert metadata |

**Bridge pattern (Phase 1 design):** Map Sanity category → `emission_factors.category_code` at order time; store snapshot on lifecycle event — do not rely on live Sanity joins for historical reports.

---

## B.4 Existing code ↔ schema alignment

| Code | Expects | Schema reality |
|------|---------|----------------|
| `lib/ai/demandEngine.ts` | `orders` history | ✅ Aligned |
| `lib/ai/wasteTracker.ts` | `produced` + `consumed` | ❌ `produced` never populated |
| `lib/ai/demandInsights.ts` | `day_choices.choice_key` | ✅ Aligned |
| Phase 1 `esg_monthly` design | Rollup table | ❌ Tables dropped |

---

## B.5 Phase 2 data foundation priority

| Order | Deliverable | Unblocks |
|------:|-------------|----------|
| 1 | **DC-ESG-100** `emission_factors` seed (category-level) | CO₂e avoided |
| 2 | **DC-ESG-101** `order_lifecycle_events` from order RPC hooks | kg avoided, ESRS E5 |
| 3 | **DC-ESG-102** `esg_tenant_monthly` materialized rollup + cron | Customer dashboard |
| 4 | Sanity category → factor mapping (no new Sanity fields required for v1) | CO₂e per lunch estimate |
| 5 | **DC-ESG-104** kitchen production capture | True waste % |
| 6 | **DC-ESG-103** delivery km | Transport Scope 3 (secondary) |
| 7 | Sanity origin/organic fields | Local-sourced % KPI |

---

## STOP — Phase 2 ESG data gap complete

*Generated READ-ONLY 2026-05-26 · No migrations applied*
