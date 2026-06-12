# Stage 4-C — Multi-lokasjon: kapabilitet eller grense (2026-05-31)

## Konklusjon: **NEI** — ett firma kan ikke ha ACTIVE ordre på ≥2 `company_locations` samme dato i dagens modell

Ikke fordi driver/kitchen ikke *kan* gruppere per lokasjon (de gjør det), men fordi **avtalemodellen tillater kun én ACTIVE avtale per firma**, bundet til **én** `location_id`, og alle ordre-innleggingsstier validerer ordre mot avtale på `(company_id, location_id)`.

---

## 1. Validering (kode/DDL)

### DDL — én ACTIVE avtale per firma

```sql
CREATE UNIQUE INDEX agreements_one_active_per_company_uq
  ON public.agreements (company_id)
  WHERE (status = 'ACTIVE');
```

`agreements.location_id` er **NOT NULL** (én lokasjon per avtale-rad).

### Trigger — ordre krever ACTIVE avtale på samme lokasjon

`tg_orders_require_active_agreement`:

```sql
select exists(
  select 1 from public.agreements a
  where a.company_id = new.company_id
    and a.location_id = new.location_id
    and a.status = 'ACTIVE'
    ...
) into ok;
```

### Trigger — hydrate: ordre.location_id må matche avtale.location_id

`tg_orders_hydrate_core_fields` (INSERT/UPDATE):

```sql
where a.company_id = new.company_id
  and a.location_id = new.location_id
  and upper(a.status::text) = 'ACTIVE'
...
if v_agreement.location_id <> new.location_id then
  raise exception 'orders.location_id must match agreements.location_id';
```

### RPC — `lp_order_set` (kanonisk employee-bestilling)

- Ordre skrives med `v_profile.location_id`.
- Avtale slås opp med `a.company_id = v_profile.company_id AND a.location_id = v_profile.location_id`.
- Meny: `menu_service_days.location_id = v_profile.location_id`.
- HTTP: `app/api/orders/route.ts`, `app/api/orders/set/route.ts` → `sb.rpc("lp_order_set", ...)`.

### Prod read-only (2026-05-31)

- `companiesWithMultiLocActiveOrders`: **[]**
- `companiesWithMultipleActiveAgreements`: **[]**

### uigx constraint-bevis

Forsøk på andre ACTIVE avtale på Loc B for Company A:

`23505` — `agreements_one_active_per_company_uq`

---

## 2. uigx 2-stop-bevis — **hoppet over**

Kan ikke seede 2+2 ACTIVE ordre på Loc A + Loc B uten å bryte modellen (ingen gyldig ACTIVE avtale på Loc B). Direkte SQL uten avtale feiler på `tg_orders_require_active_agreement` / hydrate.

**Driver-gruppering** er allerede per `date|slot|companyId|locationId` (`app/api/driver/stops/route.ts`) — forward path ved enterprise multi-kontor er **datamodell** (flere avtaler / avtale uten enkelt `location_id`), ikke driver-UI.

---

## 3. `PATCH /api/kitchen/batch`

| Sjekk | Resultat |
|-------|----------|
| `fetch("/api/kitchen/batch")` uten subpath i `app/` | **Ingen** |
| Live kjøkken UI | `batch/start`, `batch/set`, `batch/list` only |
| `delivery_batches` | Kun `app/api/kitchen/batch/route.ts` (PATCH) |

**Anbefaling (kode-PR, ikke deploy):** Deprecate `PATCH /api/kitchen/batch` eller repoint til `kitchen_batch` / `kitchen_batches`. Fjern `delivery_batches` fra `lib/types/database.ts` allowlist når ruten er borte.

---

## Enterprise multi-kontor (K1-relevant)

Kjent grense for RC: multi-location **operativt** krever schema/produktbeslutning (f.eks. avtale per lokasjon uten `one_active_per_company`, eller firm-wide avtale med flere delivery locations). Inntil da: én aktiv leveringslokasjon per firma i system truth.
