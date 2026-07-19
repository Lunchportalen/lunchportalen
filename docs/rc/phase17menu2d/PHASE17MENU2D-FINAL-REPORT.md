# PHASE 17MENU.2D — FINAL TECHNICAL MENU CERTIFICATION

## Release

- Branch: `release/global-menu-universes-21`
- Start SHA: `f08f2a83377262c2da157cba3dfb5aaee280711c`
- Certified SHA (full GHA SUCCESS): `1e2d24d9861631f8ccafb22d48c4f425f746d2ae`
- Staging target: Supabase `uigxsboqeruxflgzqztl` + Sanity `4udoq5d8` / `staging`
- Worktree: `C:\prosjekter\lunchportalen-16no`
- Production mutations: **0**

### GitHub Actions certification runs

| Run ID | Event | Head SHA | Conclusion |
|--------|-------|----------|------------|
| [29671384968](https://github.com/Lunchportalen/lunchportalen/actions/runs/29671384968) | push | `1e2d24d9` | **SUCCESS** (closure) |
| [29669451575](https://github.com/Lunchportalen/lunchportalen/actions/runs/29669451575) | workflow_dispatch | `3fbbc011` | failure (HTTP 60/63 — capacity pools left full) |
| [29666168394](https://github.com/Lunchportalen/lunchportalen/actions/runs/29666168394) | workflow_dispatch | `0248d3c5` | failure (auth seed pagination) |
| [29665877037](https://github.com/Lunchportalen/lunchportalen/actions/runs/29665877037) | push | `1e5713aa` | failure (seed race) |
| [29665876709](https://github.com/Lunchportalen/lunchportalen/actions/runs/29665876709) | workflow_dispatch | `1e5713aa` | failure (seed race) |
| [29665711247](https://github.com/Lunchportalen/lunchportalen/actions/runs/29665711247) | push | `6f36945b` | failure (seed race) |

Successful closure artifact: `docs/rc/phase17menu2d/gha-29671384968/`

## Capacity

- Atomic mechanism: `dish_day_capacity` row lock (`SELECT … FOR UPDATE`) via `lp_capacity_try_reserve` inside `order_items` AFTER INSERT trigger (same transaction as `lp_order_set`)
- Lock scope: `provider_id + service_date + choice_key` (e.g. `varmrett`)
- Race attempts: 100
- Capacity: 50
- Accepted: **50** per run (500 total)
- Rejected: **50** per run (500 total, `CAPACITY_EXCEEDED` → HTTP 409)
- Other errors: 0
- Repeated runs: **10/10**
- Oversell: **0**
- Deadlocks: **0**
- Pool teardown after race: **PASS** (does not poison later package HTTP)
- Hot-provider result: **PASS**
- Multi-provider isolation: **PASS**
- Date/variant isolation: **PASS**

## Cutoff and idempotency

- Cutoff authority: database/server via `lp_company_cutoff_context` + `now()`
- Client-clock bypasses: **0**
- Order / cancellation idempotency duplicates: **0**

## Commission ledger

- Persisted earned events: **PASS**
- Persisted reversal events: **PASS**
- 63-flow proof: **63/63**
- Earn difference: **0**
- Reversal difference: **0**
- Duplicate / orphan events: **0**

## Remainder and settlement

- Periods tested: **3**
- Remainder loss: **0**
- Settlement idempotency errors: **0**
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

Certified against remote tip SHA `1e2d24d9861631f8ccafb22d48c4f425f746d2ae` via GHA run **29671384968** (all gates SUCCESS).

Do not deploy Phase 17MENU to production.
Native culinary and locale approval remain closed.
Global scale certification remains **NO**.
