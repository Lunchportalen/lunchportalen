# PHASE 17MENU.2D — FINAL TECHNICAL MENU CERTIFICATION

## Release

- Branch: `release/global-menu-universes-21`
- Start SHA: `f08f2a83377262c2da157cba3dfb5aaee280711c`
- Certified SHA (remote tip at TECHNICAL_PASS): `e9b0596d9b68b06b3dfb45b3cd0365b1d10ffba4`
- Engine SHA (capacity teardown + HTTP 63/63 fix): `1e2d24d9861631f8ccafb22d48c4f425f746d2ae`
- Staging target: Supabase `uigxsboqeruxflgzqztl` + Sanity `4udoq5d8` / `staging`
- Worktree: `C:\prosjekter\lunchportalen-16no`
- Production mutations: **0**

### GitHub Actions certification runs

| Run ID | Event | Head SHA | Conclusion |
|--------|-------|----------|------------|
| [29673601965](https://github.com/Lunchportalen/lunchportalen/actions/runs/29673601965) | push | `e9b0596d` | **SUCCESS** (tip = certified SHA) |
| [29671384968](https://github.com/Lunchportalen/lunchportalen/actions/runs/29671384968) | push | `1e2d24d9` | **SUCCESS** (engine closure) |
| [29669451575](https://github.com/Lunchportalen/lunchportalen/actions/runs/29669451575) | workflow_dispatch | `3fbbc011` | failure (HTTP 60/63 — capacity pools left full) |
| [29666168394](https://github.com/Lunchportalen/lunchportalen/actions/runs/29666168394) | workflow_dispatch | `0248d3c5` | failure (auth seed pagination) |
| [29665877037](https://github.com/Lunchportalen/lunchportalen/actions/runs/29665877037) | push | `1e5713aa` | failure (seed race) |
| [29665876709](https://github.com/Lunchportalen/lunchportalen/actions/runs/29665876709) | workflow_dispatch | `1e5713aa` | failure (seed race) |
| [29665711247](https://github.com/Lunchportalen/lunchportalen/actions/runs/29665711247) | push | `6f36945b` | failure (seed race) |

## Capacity

- Atomic mechanism: `dish_day_capacity` row lock (`SELECT … FOR UPDATE`) via `lp_capacity_try_reserve` inside `order_items` AFTER INSERT trigger (same transaction as `lp_order_set`)
- Lock scope: `provider_id + service_date + choice_key` (e.g. `varmrett`)
- Race attempts: 100 → capacity 50 → accepted **50** / rejected **50**
- Repeated runs: **10/10** (500 accepted / 500 rejected capacity)
- Oversell: **0**
- Deadlocks: **0**
- Pool teardown after race: **PASS**
- Hot-provider / multi-provider / date / variant isolation: **PASS**

## Cutoff and idempotency

- Client-clock bypasses: **0**
- Order / cancellation idempotency duplicates: **0**

## Commission ledger

- 63-flow proof: **63/63**
- Earn difference: **0**
- Reversal difference: **0**
- Remainder periods: **3**, remainder loss: **0**
- Final rounding: **PASS**
- Total financial difference: **0**

## Visual localization

- HTTP locales: **24/24**
- Desktop locales: **24/24**
- Mobile locales: **24/24**
- Norwegian fallback outside NO: **0**
- Internal keys: **0**
- Mojibake: **0**
- Critical overflows: **0**
- Issue #503: **CLOSED** (`CLOSED_WITH_RUNTIME_EVIDENCE`)

## Regression

- Package HTTP flows: **63/63**
- Cross-tenant / cross-country / wrong provider: **0**

## Production safety

- Production SHA baseline (untouched): `771a4207e9743fd232971eb95ecc27e45723a89d`
- Production mutations: **0**
- Other countries production disabled: **20/20**
- Stripe calls: **0**

## Status boundaries (unchanged)

- `GLOBAL_SCALE_CERTIFIED = NO`
- `NATIVE_CULINARY_APPROVED = 0/21`
- `LOCALE_NATIVE_APPROVED = 0/24`
- `PRODUCTION_DEPLOYMENT = NOT APPROVED`

## Decision

**GLOBAL_MENU_UNIVERSES_TECHNICAL_PASS = YES**

Remote tip `e9b0596d9b68b06b3dfb45b3cd0365b1d10ffba4` equals GHA headSha of successful run **29673601965**.

Do not deploy Phase 17MENU to production.
