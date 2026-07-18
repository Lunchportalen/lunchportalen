# PHASE 17MENU.2D — Atomic capacity transaction design

## Mechanism

- Tables: `dish_day_capacity`, `dish_day_capacity_events`
- Reserve RPC: `lp_capacity_try_reserve` with `SELECT … FOR UPDATE` on the pool row
- Release RPC: `lp_capacity_release` (latest-event net state)
- Triggers on `order_items` AFTER INSERT / AFTER DELETE (inside `lp_order_set` transaction)

## Lock scope

`provider_id + service_date + choice_key` (canonical category slug, e.g. `varmrett`)

Does **not** lock all providers, all dates, or the full orders table.

## Opt-in enforcement

Absence of a `dish_day_capacity` row ⇒ unlimited (no capacity check).
Race harness inserts an explicit pool with `capacity_limit = 50`.

## Commit boundary

`lp_order_set` deletes/inserts `order_items` in the same plpgsql transaction.
`CAPACITY_EXCEEDED` aborts the RPC ⇒ order + items + reservation roll back together.

## API mapping

`CAPACITY_EXCEEDED` → HTTP 409 / code `CAPACITY_EXCEEDED` via `mapOrderWriteError`.

## Protected Golden Path Impact

`lp_order_set` body unchanged. Capacity is additive via triggers only.
