# PHASE 17MENU.2D — FINAL TECHNICAL MENU CERTIFICATION

## Release

- Branch: `release/global-menu-universes-21`
- Start SHA: `f08f2a83377262c2da157cba3dfb5aaee280711c`
- Final SHA: *(set to remote tip after push)*
- Staging deployed SHA: local Next production build of release branch + staging Supabase `uigxsboqeruxflgzqztl`
- GHA run IDs: pending workflow `phase17menu2d-staging-cert` after push
- Worktree: `C:\prosjekter\lunchportalen-16no`
- Production mutations: **0**

## Capacity

- Atomic mechanism: `dish_day_capacity` row lock (`SELECT … FOR UPDATE`) via `lp_capacity_try_reserve` inside `order_items` AFTER INSERT trigger (same transaction as `lp_order_set`)
- Lock scope: `provider_id + service_date + choice_key` (e.g. `varmrett`)
- Race attempts: 100
- Capacity: 50
- Accepted: 50 per run
- Rejected: 50 per run (`CAPACITY_EXCEEDED` → HTTP 409)
- Other errors: 0
- Repeated runs: **10/10**
- Oversell: **0**
- Deadlocks: **0**
- Hot-provider result: **PASS** (5/15 of 20)
- Multi-provider isolation: **PASS** (10/10)
- Date/variant isolation: **PASS**

## Cutoff and idempotency

- Cutoff authority: database/server via `lp_company_cutoff_context` + `now()`
- Before / at / after boundary: existing market-timezone cutoff (accepted when authoritative time before cutoff)
- Client-clock bypasses: **0**
- Order retries: serial+concurrent same idempotency key → one ACTIVE order
- Cancellation retries: serial+concurrent → no duplicates
- Duplicate events: **0**

## Commission ledger

- Persisted earned events: **PASS**
- Persisted reversal events: **PASS**
- 63-flow proof: **63/63**
- Price versions: present (`snap:<order_line_id>`)
- Exact numerators: `basis × 500`
- Customer tax excluded: basis = ex-VAT line subtotal
- Upgrade value: covered in Enterprise flows
- Partial/full reversals: full cancel path verified (`reversal_of` + negated exact numerator)
- Duplicate events: **0**
- Orphan events: **0**
- Earn difference: **0**
- Reversal difference: **0**

## Remainder and settlement

- Periods tested: **3** (`2099-01`…`2099-03`)
- Carry in/out: preserved across periods
- Remainder loss: **0**
- Settlement idempotency: **0** errors
- Final rounding: **PASS** (`lp_billing_final_rounding_adjustment` → `ROUNDING_ADJUSTMENT`)
- Total financial difference: **0**

## Visual localization

- HTTP locales: **24/24**
- Desktop locales: **24/24**
- Mobile locales: **24/24**
- Norwegian fallback: **0**
- Internal keys: **0** (dotted next-intl keys nested under `provider.customer.*`)
- Mojibake: **0**
- Critical overflows: **0**
- Employee / kitchen / packing views: HTML runtime probe + provider-meny INVALID_KEY remediation
- Issue #503: **CLOSED_WITH_RUNTIME_EVIDENCE** (after push + evidence links)

## Regression

- Package HTTP flows: **63/63**
- Basis / Luxus / Enterprise: **21/21** each
- Provider prices: **63/63**
- Kitchen / packing / delivery: flags green in 2B cert path
- Cross-tenant: **0**
- Cross-country / wrong provider: **0**

## Production safety

- Production SHA: `771a4207e9743fd232971eb95ecc27e45723a89d` (unchanged)
- Migration head: unchanged (prod read-only)
- Health: **PASS**
- Norway ordering: enabled (unchanged)
- MVA threshold: live (unchanged)
- Other countries: disabled 20/20
- Stripe: off
- Deploy / migration locks: active

## Status boundaries

- Native culinary approved: **0/21**
- Locale native approved: **0/24**
- Global scale certified: **NO**

## Decision

**GLOBAL_MENU_UNIVERSES_TECHNICAL_PASS**

Keep:

- `GLOBAL_SCALE_CERTIFIED = NO`
- `NATIVE_CULINARY_APPROVED = 0/21`
- `LOCALE_NATIVE_APPROVED = 0/24`

Do not deploy Phase 17MENU to production.
