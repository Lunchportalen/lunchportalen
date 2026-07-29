# MULTI-GLOBAL LIVE RELEASE REPORT — 2026-08-01

Stamp: 2026-07-29T17:57:00Z  
Overall status: **LIVE_RUN_CONTINUING** (not LIVE)

## Identities

| Field | Value |
|---|---|
| Release branch | `release/global-menu-universes-21` |
| GLOBAL_RELEASE_SHA | `d7bbb11f600138eef13e1df2226857c2fb2847d6` |
| Isolated Supabase project | `lenajhsfrqdqcdzhcuao` (eu-west-1, USD 10/mo, expires 2026-08-01T12:26:44Z) |
| Previous dead isolated project | `arstaxredytrjcmqcwhh` (gone) |
| Production project | `hkpokyapzarefrgqzkos` (never targeted by Phase 18) |
| Shared staging | `uigxsboqeruxflgzqztl` GONE |
| Active Phase 18 run | [30477652774](https://github.com/Lunchportalen/lunchportalen/actions/runs/30477652774) (`stop_after=harness-dry-run`, seed 1000/2000/420) |

## Locked commercial model

- invoice_only · Stripe OFF · provider invoices customer · Lunchportalen invoices provider
- exact 5% commission · customer tax excluded from commission base
- provider-owned prices · country=market config · locale=presentation

## Progress (measured)

| Gate | Status | Evidence |
|---|---|---|
| Isolated project restored ≤ USD 10 | PASS | `lenajhsfrqdqcdzhcuao` ACTIVE_HEALTHY |
| Pooler auth on new project | PASS | Forced rotate + post-rotate auth retry (settle) |
| Source safety / schema parity / observability | PASS | Run 30458298483 |
| Synthetic matrix seed | PASS | 1000 providers (+bootstrap), 2000 companies, 420 auth users, 21 company countries |
| Menu-path alignment | FIX LANDED | Prior fail `PHASE18_RUN_DATE_MANIFEST_MISSING` — synthetic-seed now downloads run-date artifact |
| Markets / locales / currencies registry | PASS | `verify-21-country-markets.mjs` → 21/21, 24/24 |
| GLOBAL_STAGING_RELEASE_CANDIDATE | IN_PROGRESS | Harness dry-run after seed resume |
| GLOBAL_SCALE_CERTIFIED | NO | Full 100k/50k deferred per owner §9 |
| Production deploy | BLOCKED | `OWNER_AUTHENTICATION_REQUIRED` (no `VERCEL_TOKEN`) |
| Legal/tax activation | BLOCKED | `OWNER_LEGAL_TAX_DECISION_REQUIRED` (not forged) |
| MULTI_GLOBAL_CUSTOMER_RELEASE | NOT_LIVE | Requires measured 21/21 canary + waves |

## Owner-only blockers (independent lanes continue)

1. **OWNER_AUTHENTICATION_REQUIRED** — production exact-SHA deploy / Vercel credentials
2. **OWNER_LEGAL_TAX_DECISION_REQUIRED** — native tax/legal approvals; model/text changes forbidden

## GitHub hygiene

| Metric | Value |
|---|---|
| Open PRs | 0 (autofix #572 merged to main) |
| Canonical owner Issue | #560 |
| Automation noise Issues | 0 |
| ACTIVE_PHASE18_RUNS target | ≤ 1 |

## Not claimed

- `MULTI_GLOBAL_CUSTOMER_RELEASE_LIVE`
- `GLOBAL_SCALE_CERTIFIED`
- Stripe active
- Destructive migrations
