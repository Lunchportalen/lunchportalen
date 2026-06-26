# G5d — Menu profile runtime cutover audit (read-only)

**Status:** AUDIT ONLY — no runtime cutover started  
**Date:** 2026-06-25  
**Prerequisite:** G5a/G5b/G5c DONE (merge `001d167c`), Production flags OFF  
**Related:** `G5-menu-profile-cutover-plan.md`, ADR-019, `PROTECTED_GOLDEN_PATH.md`

---

## Executive summary

G5d is the **risk phase** before any menu profile data reaches save, publish, order, or `/week` runtime. Today seven parallel truth layers exist; only layers 1–2 (UI chrome + MenuProfile presentation) are partially wired behind flags. Layers 3–7 (catalog, runtime keys, Sanity/publish, order snapshots, employee week) remain **Norwegian canonical** and **must not change without explicit GO, new flags, contract tests, and Golden Path regression**.

**Recommendation:** First safe PR = **G5d.0 contract tests only** — no runtime, UI, API, or DB changes.

---

## Part 1 — Current runtime truth map

### 1.1 Category / key truth (three namespaces)

| Namespace | Canonical source | Keys | Critical? |
|-----------|-------------------|------|-----------|
| **`Category`** (plan tier) | `lib/cms/menuDayContract.ts` | `paasmurt`, `salat`, `sushi`, `pokebowl`, `thai`, `varmrett` | **YES** — menuDay, tier plans, save, publish |
| **`lunchCategory` slug** | `studio/schemaTypes/lunchCategory.ts`, `lunchCategoryCatalog.ts` | `paasmurt`, `salatboks`, `sushi`, `pokebowl`, `thaimat`, `varmrett` | **YES** — Sanity, catalog, MSDI |
| **Order `choice_key`** | `ORDER_CHOICE_KEY_BY_CATEGORY` in `menuDayContract.ts` | same + **`varmmat`** for `varmrett` | **YES** — `lp_order_set`, kitchen, MSDI |

**Non-negotiable divergences:**

| Plan `Category` | lunchCategory key | order choice_key |
|-----------------|-------------------|------------------|
| `salat` | `salatboks` | `salatboks` |
| `thai` | `thaimat` | `thaimat` |
| `varmrett` | `varmrett` | **`varmmat`** |

**Presentation-only:**

- `CATEGORY_LABELS` — Norwegian fallback labels
- `EmployeeWeekClient.tsx` hardcoded `BASIS_CATEGORY_LABELS` / `LUXUS_CATEGORY_LABELS` (order-choice naming, different order)
- Catalog item titles (provider-owned, not i18n)

**Mapping bridges (must stay explicit):**

- `categoryFromLunchCategoryKey()` — `lunchCategoryCatalog.ts`, `lib/cms/lunchCategory.ts`
- `canonicalMenuCategory()` — `menuCategoryCanonical.ts` (aliases: `salatboks→salat`, `varmmat→varmrett`)
- `noCategoryRuntimeMap` (G5b) — `profileCategoryKey → { runtimeCategoryKey, runtimeLunchCategoryKey, runtimeOrderChoiceKey }` — **NO market only**, read-only today

**`PLAN_CATEGORIES` (runtime-critical):**

```
BASIS:      paasmurt, salat, varmrett
LUXUS:      paasmurt, salat, sushi, pokebowl, thai, varmrett
ENTERPRISE: same as LUXUS (+ enterprise upgrade slot in profile registry only)
```

**`providerWorkspaceCategories`:** Derived from Sanity catalog + tier via `providerMenuCatalogSurface.ts` → `workspaceCategoriesFromCatalog()`. Not a separate key list; intersects catalog rows with `PLAN_CATEGORIES[tier]`.

**`providerMenuTierContract.ts`:** Per-category `lunchCategoryKey`, `sanityDriven` (only `varmrett=true` in code), labels. Runtime-critical for publish behavior split (fixed vs daily slot).

**Profile registry keys (inert):** `lib/menu-profile/registry.ts` — e.g. IT `panini`, DE `belegte_broetchen`, NO `norwegian_company_lunch`. Non-NO keys have **no** `noCategoryRuntimeMap` entry → presentation-only until mapped.

---

### 1.2 Menu day save truth

**Entry:** `ProviderMenuBuilder.save()` → `POST /api/provider/menu-days` or `POST .../varmrett`

**Payload (per slot):** `date`, `tier`, `category` (canonical `Category`), `mealTitle`, `description`, `allergensText`, `estimatedCostPerPortion`, enterprise fields, `status`

**Varmrett shared:** omits tier/category; server writes all tiers with `category: "varmrett"` via `varmrettSharedWrite.ts`

**Sanity doc:** `buildMenuDayPayload()` — `_type: menuDay`, canonical `category` only, `provider` from server context (never client)

**Must snapshot:**

- `mealTitle`, `description`, `allergens`, `estimatedCostPerPortion` on every save/publish
- `generatedBaseline` on auto-rollout / preserved on provider override
- Fixed-choice item titles live in **catalog**, not menuDay save

**Fail-closed today:**

- `canonicalMenuCategory()` + `PLAN_CATEGORIES[tier]` gate
- Order locks: `assertVarmrettContentChangeAllowed()`, `assertCatalogWriteAllowed()`
- No `menuProfileId` or profile category keys in save chain

**G5d requirement:** Profile keys must **never** enter `buildMenuDayPayload` without dedicated flag + contract test + migration plan.

---

### 1.3 Catalog save truth

**Entry:** `POST /api/provider/menu-catalog` → `menuCatalogWrite.ts`

**Editable keys only:** `paasmurt`, `salatboks`, `sushi`, `pokebowl`, `thaimat` — **`varmrett` not catalog-editable**

**Provider-owned data:** item `title`, `description`, `allergens`, `isVegetarian` stored in Sanity — **must not auto-translate** via UI locale or MenuProfile.

**Profile linkage (future):** Profile categories could map to existing lunch keys via explicit bridge (like `noCategoryRuntimeMap`); catalog rows remain provider-authored content.

---

### 1.4 Publish truth

**Chain:** Provider publish / auto-rollout → Sanity `menuDay` (`approvedForPublish` + `customerVisible`) → webhook or inline → `syncMenuServiceDaysForPublishedMenuDay` → `syncMenuServiceDayItemsAfterMenuDayItems`

**Auto-rollout:** `runMenuWeekRolloutCore.ts` — writes **`varmrett` only**, Melhus-scoped, `generatedBaseline` snapshot

**MSDI sync:** `LUNCH_CATEGORY_KEY_TO_DB_NAME`, `ALLOWED_SKUS`, `product_name_snapshot` from catalog titles or varmrett menuDay

**No imports** of `lib/menu-profile/` in `lib/menu-publish/**`

**Rollback requirement:** Any G5d publish shadow must compare against current payload; production serve path unchanged until explicit GO.

---

### 1.5 Order truth

**Write:** `app/api/orders/set` → `resolveOrderDayItemPersist` (server snapshot) → `lp_order_set`

**Snapshots:** `day_choices.choice_key`, `item_key`, `item_title_snapshot`; `order_items.product_name_snapshot`, `vat_rate_snapshot` via trigger

**Provider read:** `KitchenOrderCard`, `kitchenOrderDisplay.ts`, `providerOrderEnrichment.ts` — display from snapshots + choice_key

**Old orders:** Must remain readable with historical choice keys; no retroactive profile key rewrite.

---

### 1.6 Employee `/week` truth

**APIs:** `/api/order/window` (primary), `/api/week`

**Guards:** `assertEmployeeOrderBodyHasNoPricingOverrides` — blocks price/currency/tier from employee body

**Display:** Categories from MSDI + hardcoded labels; allergens per item; cutoff via Oslo 08:00; **no employer prices**

**G5d constraint:** Profile data may appear later as display-only; must not expose commercial/pricing/provision.

---

### 1.7 Billing / commercial truth

**Provider meny:** `provider_price_rules`, `providerMenuPriceConfig.ts`, `providerMenuPricePreview.ts` (diagnostics, separate flag `LP_PROVIDER_PRICE_PREVIEW_DISPLAY`)

**Market config:** `marketConfigs.ts` marked NOT FOR RUNTIME; `menu-profile/marketDefaults.ts` inert

**Tripletex:** NOK/Norway-specific paths; commission 5% in commercial model (ADR-019)

**G5d constraint:** Market/currency cutover is **separate** from category cutover; requires agreement/commercial model GO.

---

## Part 2 — G5a/G5b/G5c reusable outputs

| Phase | Deliverable | Reusable in G5d | Must stay presentation-only |
|-------|-------------|-----------------|------------------------------|
| **G5a** | `providerMenuProfilePresentation.ts`, banner, resolver, registry | Profile meta, package matrix labels, resolver entry point | Until G5d.4+ |
| **G5b** | `providerMenuProfileFixedCategories.ts`, `noCategoryRuntimeMap.ts`, panel | **Template for runtime mapping layer** (G5d.1) | Panel + map usage in save/publish |
| **G5c** | `providerMenuProfileWarmDishPreview.ts`, `warmDishBankSeeds.ts`, panel | Seed bank for draft/shadow publish (G5d.4+) | Preview IDs (`warm-dish-preview:*`), apply/publish |

**Existing tests (isolation guards):**

- `menyProfilePresentation.test.tsx`, `menyFixedCategories.test.tsx`, `menyWarmDishPreview.test.tsx`
- `providerMenuProfile*.test.ts`, `warmDishBankSeeds.test.ts`, `menuProfileResolver.test.ts`
- Static assertions: G5 files must not import `menuDayPayload`, `lp_order_set`, publish paths

**Move to runtime first (recommended order):**

1. Pure mapping types + per-market maps (extend `noCategoryRuntimeMap` pattern)
2. Contract tests locking current payloads
3. Draft metadata persistence (no order/publish)
4. Shadow publish diff
5. NO-only cutover with zero shadow diff

---

## Part 3 — Cutover risk map

| # | Risk | Likelihood | Impact | Key files | Current guard | Missing guard | Mitigation | Required test |
|---|------|------------|--------|-----------|---------------|---------------|------------|---------------|
| 1 | Profile category key in save payload | Medium | Critical | `menuDayPayload.ts`, `ProviderMenuBuilder.tsx` | `CATEGORIES` enum, no profile imports | Contract snapshot test | G5d.0 snapshot; G5d.1 mapping only; fail-closed parse | Save payload snapshot rejects unknown keys |
| 2 | Profile key in order choice_key | Medium | Critical | `menuDayContract.ts`, `lp_order_set`, `orders/set` | Locked `ORDER_CHOICE_KEY_BY_CATEGORY` | Reject unknown choice_key in RPC/API | No choice key change without migration | Order write rejects `panini`, `warm-dish-preview:*` |
| 3 | Warm dish preview published without confirmation | Low | High | `warmDishBankSeeds.ts`, publish sync | Preview IDs prefixed `warm-dish-preview:`; `canPublish: false` | Sanity write guard for preview IDs | Explicit provider confirm step in G5d.5+ | Publish payload never contains preview IDs |
| 4 | Provider-owned data auto-translated | Medium | High | Catalog, `/week`, i18n | Data stored as authored titles | Lint/guard: no i18n on catalog titles | Profile labels ≠ catalog mutation | Catalog snapshot unchanged when UI locale changes |
| 5 | `/week` shows prices/commercial | Low | Critical | `EmployeeWeekClient.tsx`, `order/window` | Price-free guard, no price in API model | Contract test on window response shape | Separate commercial flag | Window payload snapshot: no price fields |
| 6 | Sanity write gets preview IDs | Low | High | `menuCatalogWrite.ts`, `menuDayPayload.ts` | Preview IDs only in G5c builder | Explicit reject in validators | Fail-closed Sanity patch | Sanity write rejects `warm-dish-preview:*` |
| 7 | Old orders/snapshots break | Medium | Critical | `lp_order_set`, `day_choices`, kitchen display | Immutable snapshots | Read-path dual-key support if keys ever change | Never rewrite history; additive mapping only | Old order fixture remains readable |
| 8 | NO/Melhus Golden Path regression | Medium | Critical | Protected path files | `test:golden-path`, CI guard | G5d PR must declare impact | Shadow mode before cutover | Full golden-path suite on every G5d PR |
| 9 | Market/currency changed without commercial model | Low | Critical | `provider_price_rules`, Tripletex, ADR-019 | Market config inert | Separate flag for commercial cutover | Decouple G5d category from G6 commercial | Billing tests unchanged in G5d.0–G5d.5 |
| 10 | Tripletex/Norway billing mixed with global runtime | Low | High | Tripletex integrations | Norway-specific invoice paths | Explicit market gate on billing sync | Non-NO pilot without Tripletex | Tripletex path untouched in category G5d |

---

## Part 4 — Recommended G5d subphases

| Phase | Scope | Runtime change? | Flag |
|-------|-------|-----------------|------|
| **G5d.0** | Contract tests + fixtures + CI guards | **No** | None |
| **G5d.1** | Pure mapping layer (`MarketCategoryRuntimeMap`) | **No** — types + maps only | `LP_MENU_PROFILE_RUNTIME_MAP` default OFF |
| **G5d.2** | Provider workspace mapping proposal UI | **No** — read-only proposal | Same |
| **G5d.3** | Draft mapping persistence (new table/metadata) | **DB only** — no publish/order/week | Staging-only flag |
| **G5d.4** | Publish shadow payload + diff log | **Shadow only** — not served | Staging + explicit env |
| **G5d.5** | `/week` shadow read (test harness) | **No employee-visible change** | Test-only |
| **G5d.6** | Single-market NO cutover | **YES** — requires zero shadow diff + GO | Production GO per flag |
| **G5d.7** | Non-NO demo pilot | **YES** — staging/demo provider only | Explicit GO, no billing |

**Order rationale:** Lock contracts before code; maps before persistence; persistence before shadow; shadow before any user-visible cutover; NO before global.

---

## Part 5 — Recommended first PR (G5d.0)

**Title:** `test(menu-profile): lock menu profile runtime cutover contracts`

**Scope:** Tests, fixtures, optional CI guard extensions only.

**Suggested tests:**

1. Provider menu save payload snapshot (`buildMenuDayPayload`)
2. Catalog save payload snapshot (`validateMenuCatalogWriteInput` / write doc shape)
3. Publish MSDI snapshot (`syncMenuServiceDayItems` fixture)
4. `menuDayPayload` canonical category set unchanged
5. `/api/order/window` employee response — no price/commercial fields
6. Order write path rejects unknown profile keys (static or integration)
7. Sanity write rejects `warm-dish-preview:*` IDs
8. Warm dish preview never in publish payload builder output
9. G5b presentation keys never in save payload builder input/output
10. Golden Path fixture payloads unchanged (reference pilot)
11. Old order read fixtures remain readable
12. Tripletex modules not imported by new tests touching menu-profile
13. Extend `commercial-hardcodes-guard` allowlist only if new test fixtures require it

**Gates:** `typecheck`, `lint`, `test:golden-path`, new contract test job or vitest suite

---

## Part 6 — Files inspected (audit)

**Category/contract:** `lib/cms/menuDayContract.ts`, `lib/provider-menu/menuCategoryCanonical.ts`, `lib/provider-menu/lunchCategoryCatalog.ts`, `lib/provider-menu/providerMenuTierContract.ts`, `lib/menu-profile/noCategoryRuntimeMap.ts`, `lib/menu-profile/registry.ts`

**Save/publish:** `lib/provider-menu/menuDayPayload.ts`, `varmrettSharedWrite.ts`, `menuCatalogWrite.ts`, `app/api/provider/menu-days/**`, `app/api/provider/menu-catalog/route.ts`, `lib/menu-publish/**`

**Order/week:** `app/api/orders/set/route.ts`, `app/api/order/window/route.ts`, `lib/orders/**`, `app/(app)/week/EmployeeWeekClient.tsx`, `lib/week/**`

**G5a–G5c:** `lib/menu-profile/featureFlag.ts`, `providerMenuProfilePresentation.ts`, `providerMenuProfileFixedCategories.ts`, `providerMenuProfileWarmDishPreview.ts`, related components and tests

**Billing:** `lib/providers/providerMenuPriceConfig.ts`, `providerMenuPricePreview.ts`, `lib/commercial/marketConfigs.ts`

**Docs:** `G5-menu-profile-cutover-plan.md`, ADR-019, `PROTECTED_GOLDEN_PATH.md`

---

## Files changed in this audit

- `docs/engineering/G5d-menu-profile-cutover-audit.md` (this document only)

**No runtime code changed. No PR opened. Production flags unchanged.**

---

## Recommendation

**Safe next step:** G5d.0 contract tests PR (after explicit GO for G5d.0 only).  
**Not safe:** Any PR touching `menuDayPayload`, publish sync, `lp_order_set`, `/week` API, or enabling Production `LP_MENU_PROFILE_*` flags.
