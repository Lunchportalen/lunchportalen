# PHASE 17MENU — 21 MARKET-SPECIFIC MENU UNIVERSES

**Decision:** `GLOBAL_MENU_UNIVERSES_REVIEW_READY`

Technical certification artifacts and Norway-safe runtime foundations are in place. Native culinary approval remains pending for non-NO markets. Non-NO countries remain **disabled in production**.

## Baseline

| Field | Value |
|-------|--------|
| 16NO.4B | RELEASE_HYGIENE_PASS |
| Production SHA | `771a4207e9743fd232971eb95ecc27e45723a89d` |
| Migration head (prod at start) | `20260904120000` |
| New migration (staging applied) | `phase17menu_package_entitlements_canonical` on `uigxsboqeruxflgzqztl` (prod not applied) |
| Production locks | ACTIVE (deploy + migration) |
| Norway ordering | ENABLED |
| MVA threshold | LIVE |
| Other countries | disabled 20/20 |
| Stripe | OFF / invoice_only |

## Global counts

| Dimension | Count |
|-----------|------:|
| Countries | 21 |
| Market profiles | 21 |
| Locales | 24 |
| Base languages | 15 |
| Currencies | 11 |

## Package contracts

| Field | Value |
|-------|--------|
| Basis | sandwich, salad_box, warm_meal |
| Luxus | Basis + sushi, poke_bowl, thai |
| Enterprise | Luxus food + enterprise_upgrade metadata on shared warm dish (ADR-019) |
| Runtime entitlement source | `provider_package_entitlements` via `resolvePackageEntitlements` (+ dual-read legacy keys) |
| Package/country matrix | 63/63 PASS (evidence) |
| Entitlement bypasses | 0 (server assert; fail-closed when `LP_PACKAGE_ENTITLEMENTS_RUNTIME=1`) |

## Fixed choices

| Category | Status |
|----------|--------|
| sandwich / Påsmurt | Contract audited; NO subchoices retained; country item keys in universes |
| salad_box | Contract audited |
| sushi | Single pack subchoice (no invented extras) |
| thai | 3 subchoice slots per country universe |
| poke_bowl | 3 protein slots per country universe |
| warm_meal | Country warm banks ≥ calculated minimum |
| enterprise_upgrade | Not orderable; contract frozen in ENTERPRISE_UPGRADE_CONTRACT.md |

## Market universes

See `evidence/universes/*.json` and `evidence/cross-country-uniqueness.md`.

| Metric | Value |
|--------|-------|
| TECHNICAL_MENU_UNIVERSE_READY | 21/21 (staging evidence + schema axis) |
| NATIVE_CULINARY_APPROVED | 0/21 (honest; review packs pending) |
| LOCALE_NATIVE_APPROVED | 0/24 |
| CHANGES_REQUIRED | 0 (technical) |
| REVIEW_PACKS_READY | 21 profile markdowns under `profiles/` |

## Warm-dish system

| Gate | Value |
|------|--------|
| Banks | 21/21 |
| Generation | 21/21 draft-only, bank-bound |
| Draft approval | required |
| Repeat avoidance | encoded in bank sizing |
| Allergens | identity on dish keys |
| Common dish across packages | enforced helper |
| Manual overrides | audit type defined |
| Audit | `lib/menu-publish/warmDishGenerationAudit.ts` |

## Localization

| Gate | Value |
|------|--------|
| Locale coverage | 24/24 |
| Missing fields | 0 (required evidence) |
| Runtime fallback | fail-closed policy documented |
| Norwegian leakage outside NO | NONE in locale evidence |
| Issue #503 | timeZone fixed; close when PR CI green (`evidence/issue-503-closure.md`) |
| Native approvals | 0 |

## End-to-end

Staging certification harness evidence: `evidence/e2e/matrix-summary.json` (63 package flows).  
Live staging tenant E2E against Sanity/Supabase staging remains the operator follow-up to materialize seeds (`sanity:seed-phase17menu-universes` on staging dataset only).

## Safety

| Gate | Value |
|------|--------|
| Cross-country leaks | 0 |
| Cross-tenant | 0 |
| Wrong provider | 0 |
| Historical snapshots | `OrderMenuSnapshotV1` shape shipped |
| Other countries disabled | 20/20 |
| Norway regression | PASS (adapter preserves golden-path keys) |
| MVA threshold | YES |
| Stripe | OFF |
| Production health | unchanged by this phase (no prod activate) |

## Certification

| Status | Count |
|--------|------:|
| TECHNICAL_MENU_UNIVERSE_READY | 21 |
| NATIVE_CULINARY_APPROVED | 0 |
| LOCALE_NATIVE_APPROVED | 0 |
| CHANGES_REQUIRED | 0 |
| REVIEW_PACKS_READY | 21 |

## Decision

**`GLOBAL_MENU_UNIVERSES_REVIEW_READY`**

Rationale: technical gates and artifacts for 21/21 profiles, universes, warm banks, generation, 63 package matrix, and 24 locales are green in-repo; entitlement runtime + canonical keys + Sanity market axis + Norway adapter are implemented. Native culinary approval is intentionally not claimed. Production must not enable non-NO markets until owner/native review and staging live E2E tenant runs complete.

Staging entitlement dual-write **applied**. Remaining for a later `TECHNICAL_PASS` promotion: live Sanity staging universe seed + isolated tenant order→delivery runs in CI.

## Operator next steps

1. ~~Apply staging entitlement migration~~ **DONE**
2. Run `NEXT_PUBLIC_SANITY_DATASET=<staging> npm run sanity:seed-phase17menu-universes`.
3. Enable `LP_PACKAGE_ENTITLEMENTS_RUNTIME=1` on staging; run package bypass tests.
4. Norway-safe production runtime deploy (exact-SHA) — **do not** enable other countries; do not apply prod migration without protected path.
5. ~~Close #503~~ **DONE**; leave #501/#502 open.
6. Native culinary review packs → promote `NATIVE_CULINARY_APPROVED` per country.
