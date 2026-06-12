# `daily_employee_orders` — optimalisering, ikke krav (2026-05-31)

## Scope

Kun **`GET /api/kitchen/orders`** og **`GET /api/kitchen/orders.csv`** via `lib/kitchen/ordersFeed.ts` (`loadKitchenFeed`).

**Ikke** brukt av:

- `GET /api/kitchen` (operative) — `loadOperativeKitchenOrders` → `orders` + `day_choices`
- Kjøkken batch (`kitchen_batch` / `kitchen_batches`)
- Sjåfør (`/api/driver/stops`, `/api/driver/today`) — samme operative sti

## Fallback (fasit i kode)

```228:230:lib/kitchen/ordersFeed.ts
export async function loadKitchenFeed(date: string, scope: KitchenScope): Promise<KitchenFeed> {
  const rowsDaily = await fetchRowsFromDaily(date, scope);
  const rows = rowsDaily ?? (await fetchRowsFromOrders(date, scope));
```

- Mangler tabell/kolonne → `fetchRowsFromDaily` returnerer `null` → leser `orders` med `KITCHEN_FEED_ORDER_COLUMNS`.
- `normStatus` aksepterer `ACTIVE` og `ORDERED` — samme operative status som kjøkken.

## Produsent

- **Ingen** app/cron-skriver i gjeldende repo.
- Eneste DDL/materialisering: arkivert migrasjon (`_archive/20260218_orders_rollup_invoice_esg_overview.sql`).

**Konklusjon:** Forward DDL uten produsent gir tom materialisert feed — designhull, ikke bare DDL.

## Beslutning (Stage 4)

| | |
|---|---|
| Klassifisering | **C** (harness EXPECTED-RED) for prod; **optimalisering** for produkt |
| Forward | **Nei** (innen kitchen/driver closeout) |
| db-rebuild-verify | Fjernet fra `REQUIRED_TABLES`; listet under `EXPECTED_RED_TABLES` |

## uigx-bevis (2026-06-04, A6-tenant)

Pipeline: 18 migrasjoner + `seed-staging-tenant.sql` + `seed-smoke-menu-fixture.mjs` + `stage4-uigx-kitchen-driver-seed.mjs`.

`kitchen-feed-smoke.mjs` (2×): identisk SHA256 med `daily_employee_orders` **absent** — feed komplett via `orders`-fallback.
