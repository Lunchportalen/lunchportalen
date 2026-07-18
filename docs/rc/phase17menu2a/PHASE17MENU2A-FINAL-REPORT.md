# PHASE 17MENU.2A — PRODUCTION-READY RECIPE BANKS + STAGING RUNTIME

**Decision:** `GLOBAL_MENU_UNIVERSES_REVIEW_READY`

Recipe/generation technical layer is green. Full `GLOBAL_MENU_UNIVERSES_TECHNICAL_PASS` is **not** declared: live HTTP 63-flow certification and complete real market citations remain open. Those are blocked only where owner credentials are required (Vercel SSO / staging service-role auth), not for ordinary recipe work.

---

## Source

| Field | Value |
|-------|--------|
| Branch | `release/global-menu-universes-21` |
| Recipe version | `17menu2a.1` |
| Sanity | `4udoq5d8` / `staging` |
| Staging Supabase | `uigxsboqeruxflgzqztl` |
| Production mutations | **0** |
| Native culinary | **0/21** |
| Locale native | **0/24** |
| GLOBAL_SCALE_CERTIFIED | **NO** |

---

## Recipe / generation gates (PASS)

| Gate | Result |
|------|--------|
| Structured recipes | **1155 / 1155** |
| Generation-eligible | **21/21 banks (≥55 each)** |
| Country-specific banks | **21/21** |
| NORWAY_RECIPE_CLONE_COUNTRIES | **0** |
| WARM_BANKS_ADEQUATE | **21/21** |
| DAYS_WITH_FEWER_THAN_THREE_ELIGIBLE_RECIPES | **0** |
| LIVE_WARM_GENERATION | **21/21** |
| WARM_DAYS_GENERATED | **840** |
| GENERATION_FROM_STUB | **0** |
| AUTO_PUBLICATION_WITHOUT_PROVIDER_APPROVAL | **0** |
| Recipe margin commission engine | **canonical 500 bps** |

Artifacts:

- `docs/rc/phase17menu2a/recipe-banks/{CC}.json`
- `docs/rc/phase17menu2a/sanity-sync/{CC}.ndjson`
- `docs/rc/phase17menu2a/evidence/*`
- Commands: `npm run phase17menu2a:build-recipes`, `phase17menu2a:generate`, `ci:phase17menu2a-gates`

Lifecycle states remain explicit: meal idea → structured draft → kitchen-reviewed → generation-eligible → provider-approved → published week item. No automatic promotion beyond kitchen-reviewed → generation-eligible after mandatory fields are complete.

Cost basis labels used: `country_benchmark` and `estimate_requiring_provider_review` (not provider_actual).

---

## Not yet PASS (continue / credential-gated)

| Gate | Status |
|------|--------|
| Sanity mealIdea `productionReadyRecipe` sync | In progress via MCP / `sync-recipes-sanity-staging.mjs` |
| Market dossiers ≥12+12 real observations | **0/21 complete** (DK/NO partial real citations started; others incomplete — honest) |
| `LP_PACKAGE_ENTITLEMENTS_RUNTIME=1` on staging app | Needs Vercel login (owner credential) |
| Preview HTTP (Vercel SSO 302) | Needs SSO bypass or local app + staging |
| HTTP_PACKAGE_FLOWS 63/63 | Blocked until app auth against staging |
| LIVE_LOCALE_HTTP_E2E 24/24 | Same |
| Staging service-role for synthetic employees | Missing in agent env (`OWNER` credential) |

---

## Owner credentials only (not ordinary work)

1. `vercel login` → set `LP_PACKAGE_ENTITLEMENTS_RUNTIME=1` on preview/staging **only**
2. Preview SSO bypass **or** staging `SUPABASE_SERVICE_ROLE_KEY` for local Next + HTTP E2E users
3. Optional: `SANITY_WRITE_TOKEN` if MCP sync does not finish all 1155 patches

---

## Production safety

Read-only production probes only. No production Sanity writes. No production migrations/deploys.

---

## Decision

**`GLOBAL_MENU_UNIVERSES_REVIEW_READY`**

Do not restore `TECHNICAL_PASS` until HTTP 63 + locale 24 + dossier completeness + entitlement runtime ACTIVE are proven on real staging systems.
