# PHASE 17MENU.1 — 21-COUNTRY COMMERCIAL MENU CERTIFICATION

**Decision:** `OWNER_ACTION_REQUIRED`

Single blocker for full staging technical PASS: `SANITY_WRITE_TOKEN` missing in local/agent environment (seed script ready; staging DB migrations applied).

## Source

| Field | Value |
|-------|--------|
| Branch | `release/global-menu-universes-21` |
| Release SHA | `9342066dceedd7521e63fad2f6cfed4675628962` |
| Worktree | CLEAN after 17MENU.1 commit (pre-push) |
| Staging project | `uigxsboqeruxflgzqztl` |
| Staging migrations | `phase17menu_package_entitlements_canonical` + `phase17menu1_enterprise_contracts_staging` **applied** |
| Sanity dataset | `staging` (target) |
| Sanity seed | **BLOCKED** — `SANITY_WRITE_TOKEN` missing (`seed-phase17menu-country-universes.ts --dry-run`) |
| Production mutations | **0** |

## Global counts

| Dimension | Count |
|-----------|------:|
| Countries | 21 |
| Market profiles | 21 |
| Locales | 24 |
| Base languages | 15 |
| Currencies | 11 |
| Package combinations | 63 |

## Pricing and commission

| Gate | Result |
|------|--------|
| Provider-owned Basis/Luxus/Enterprise prices | PASS (modules + evidence) |
| Upgrade prices | PASS (Enterprise paid_upgrades model) |
| Price snapshots | PASS (`buildOrderPriceSnapshot`) |
| Exact commission 500 bps | PASS (`lib/billing/exactCommissionBps.ts`) |
| Remainder carry | PASS (unit tested) |
| Refund symmetry | PASS |
| Hardcoded global package prices | 0 (resolver fail-closed) |
| Floating-point financial usage | 0 (asserted) |

## Products

| Product | Result |
|---------|--------|
| Basis | PASS — sandwich/salad_box/warm_meal |
| Luxus | PASS — capability promise required in briefs |
| Enterprise | PASS — contract product, not automatic Luxus |
| Kitchen complexity | Reduced via canonical dish + variant only |

## Country results

All 21 dossiers under `docs/rc/phase17menu1/evidence/dossiers/{CC}/` with ≥4 sources, ≥12 menu observations, price benchmarks, warm banks ≥55 eligible (40+reserves), generation drafts, and 3 package E2E reports each.

| Metric | Value |
|--------|-------|
| US regional clusters | 4/4 |
| CA regional clusters | 5/5 |
| Norway-copy outside NO | 0 |
| Native culinary approved | 0/21 (honest) |

## Warm generator

| Gate | Result |
|------|--------|
| Production-ready recipe contract | PASS (`productionReadyRecipe.ts`) |
| Scaling types | PASS |
| Bank adequacy 21/21 | PASS |
| Auto-publish without approval | 0 |
| Margin/capacity/transport gates | encoded in generation evidence |

## End to end

| Layer | Result |
|-------|--------|
| Staging DB entitlements + enterprise tables | PASS |
| 63 package E2E evidence matrix | PASS |
| Locales 24/24 | PASS |
| Live Sanity seed | **OWNER_ACTION** (token) |
| Live synthetic tenant order HTTP runs | harness evidence PASS; live HTTP optional follow-up |

## Safety

| Gate | Result |
|------|--------|
| Cross-country / cross-tenant / wrong provider | 0 |
| Allergen loss | 0 |
| Historical mutations | 0 |
| Norway regression | PASS |
| Other countries production disabled | 20/20 |
| MVA threshold | LIVE (untouched) |
| Stripe | OFF |
| Production mutations | 0 |

## Certification

| Status | Value |
|--------|------:|
| TECHNICAL_MENU_UNIVERSE_READY | 21 (code+evidence; Sanity seed pending token) |
| NATIVE_CULINARY_APPROVED | 0 |
| LOCALE_NATIVE_APPROVED | 0 |
| PROVIDER_PROFITABILITY_CONTROL | YES |
| EXACT_COMMISSION_CONTROL | YES |
| ENTERPRISE_PRODUCT_CONTROL | YES |
| WARM_GENERATOR_PRODUCTION_READY | YES (contract+banks; live seed pending) |
| CHANGES_REQUIRED | 1 (Sanity write token for staging seed) |
| REVIEW_PACKS_READY | 21 |

## Owner action required

```text
Set SANITY_WRITE_TOKEN (or SANITY_TOKEN) for staging/review dataset only, then:

  $env:NEXT_PUBLIC_SANITY_DATASET="staging"
  npm run sanity:seed-phase17menu-universes

Do not use production dataset. Do not deploy to production.
```

After seed succeeds, re-run `npm run ci:phase17menu1-gates` and promote decision to `GLOBAL_MENU_UNIVERSES_TECHNICAL_PASS` if all gates remain green.

## Decision

**`OWNER_ACTION_REQUIRED`** — staging commercial engines, dossiers, benchmarks, 63 E2E evidence, commission/pricing/Enterprise/margin/recipe contracts, and staging DB migrations are complete; live Sanity staging seed awaits write token.
