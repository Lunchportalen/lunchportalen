# PHASE 18SCALE — Progress

## Baseline

- Branch: `release/global-menu-universes-21`
- PHASE18_ENGINE_BASELINE_SHA: `c4df05397374648025024d67204d801cae6f93ea`
- GLOBAL_MENU_UNIVERSES_TECHNICAL_PASS: YES (unchanged)

## Local matrix — PASS

| Metric | Value |
|--------|-------|
| Providers | 1000 |
| Companies | 2000 |
| Employee profiles | 100000 |
| Auth identities | 100000 |
| Countries / locales / packages | 21 / 24 / 3 |
| Active agreements | 2000 |
| Published menus | 2000 |
| Package entitlements | 16000 |
| Active same-day orders (bulk setup) | 100000 |
| Load sessions (cookie login pool) | 2250 (all companies) |
| Auth idempotency / orphans | PASS / 0 |

### Auth method

1. GoTrue Admin API (first ~5k) with paginated email cache + retry
2. Local SQL bulk Auth (5k–100k) — GoTrue-compatible (`instance_id`, empty token columns, shared bcrypt)
3. Profile company/location SQL backfill (trigger creates bare profiles)
4. Session pool via password + `/api/auth/login` cookies (middleware requires SSR cookies, not Bearer alone)

### Orders

- Bulk batched SQL preload: **100000 ACTIVE** with order_items, provider/company/employee/agreement
- HTTP order path: login cookies OK; MSDI choice mapping still being aligned for full HTTP waves (`varmmat` → MSDI)

## Cloud

See `evidence/cloud-target-assessment.json`.

- Local cannot set `GLOBAL_SCALE_CERTIFIED`
- Shared staging branch is **AVAILABLE_BUT_NOT_ISOLATED**
- Isolated production-like cloud requires **Supabase preview branch** (paid, not activated)

## Status

- LOCAL_CORRECTNESS_CERTIFIED = NO (HTTP waves / cutoff / soak pending)
- GLOBAL_SCALE_CERTIFIED = NO
- NATIVE_CULINARY_APPROVED = 0/21
- LOCALE_NATIVE_APPROVED = 0/24
- PRODUCTION_DEPLOYMENT = NOT APPROVED
- PRODUCTION_MUTATIONS = 0
