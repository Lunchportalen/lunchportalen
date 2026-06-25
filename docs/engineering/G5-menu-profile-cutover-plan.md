# G5 — Menu profile cutover plan (read-only audit)

**Status:** Pre-G5 polish only. Runtime cutover **NOT** started.  
**Date:** 2026-06-25  
**Related:** ADR-019, `LP_MENU_PROFILE_RESOLVER`, PR #343/#344 provider shell locale.

---

## Executive summary

Italian/German provider **UI chrome** translates via `lp_locale` + next-intl. **Menu categories, fixed choices, and warm dishes remain Norwegian** because they come from Norwegian seed data and locked contracts — not from UI locale. This is **expected until G5** and **cannot be fixed with i18n alone**.

---

## Root cause — why Norwegian menu/retter persist

| Layer | Source | Translated by UI locale? |
|-------|--------|--------------------------|
| Provider nav/chrome | `messages/*.json` → `provider.nav.*` | Yes |
| Operational language dropdown | `provider_settings.locale` (inert in runtime) | Separate concern |
| Category keys & labels | `lib/cms/menuDayContract.ts` → `CATEGORY_LABELS`, `PLAN_CATEGORIES` | No — hardcoded Norwegian |
| Category display fallback | `lib/provider-menu/providerMenuWorkspace.ts` → `CATEGORY_LABELS` when catalog missing | No |
| Catalog category titles | Provider DB / Sanity `lunchCategory` rows (Norwegian seed) | No — provider-owned data |
| Fixed choice titles | Catalog items (`Ost & Skinke`, `Laks & Eggerøre`, …) from Sanity seed / provider catalog | No — provider-owned data |
| Warm dish titles | Sanity `mealIdea` / published day slots / generated day menu | No — content data |
| Menu profile registry | `lib/menu-profile/registry.ts` + `warmDishBankSeeds.ts` | Inert — flag OFF, not wired |

**`LP_MENU_PROFILE_RESOLVER`** defaults OFF (`lib/menu-profile/featureFlag.ts`). Resolver and registry exist for future cutover but are **not connected** to `/leverandor/meny` presentation, publish, or `/week`.

---

## Audit answers

### 1. Where do categories in `/leverandor/meny` come from?

Primary chain:

1. **`PLAN_CATEGORIES`** in `lib/cms/menuDayContract.ts` — tier → category keys (`paasmurt`, `salat`, …).
2. **`PROVIDER_MENU_CATEGORY_ORDER`** / `menuCategoryCanonical.ts` — display order.
3. **`providerMenuWorkspace.ts`** — `buildEditorContext`, `summarizeWeekMetrics` use `CATEGORY_LABELS` fallback or `categoryLabelFromCatalog(catalog, category)`.
4. **Provider catalog** — `ProviderMenuCatalogSnapshot` from Sanity/DB via `lunchCategoryCatalog.ts`.
5. **Not from MenuProfile registry at runtime** — registry is seed-only behind flag.

Sanity supplies editable lunch categories; contract keys map via `categoryFromLunchCategoryKey`.

### 2. Where do Norwegian category names come from?

`lib/cms/menuDayContract.ts`:

```ts
CATEGORY_LABELS = {
  paasmurt: "Påsmurt",
  salat: "Salat",
  sushi: "Sushi",
  pokebowl: "Pokébowl",
  thai: "Thai",
  varmrett: "Varmrett",
}
```

Catalog row titles override when present (also Norwegian from seed).

### 3. Where do fixed choices come from?

- **Catalog items** per category: `lib/provider-menu/lunchCategoryCatalog.ts` → `fixedVariantsFromCatalog` (via `providerMenuCatalogSurface.ts`).
- **Seed data:** `scripts/sanity/seed-lunch-categories-v2.ts`, `e2e/fixtures/provider-meny-catalog.json`.
- **Canonical titles:** `lib/provider-menu/providerMenuTierContract.ts` (`canonicalVariantTitle`).
- Examples (`Ost & Skinke`, `Laks & Eggerøre`, `Kylling karri`, `Vegetar`, …) are **stored titles**, not i18n keys.

### 4. Where do warm dishes (varmrett) come from?

- **Sanity-driven categories** (`sushi`, `pokebowl`, `thai`, `varmrett`) via `isSanityDrivenCategory`.
- **Published/draft slots** — `mergeProviderMenuSlots.ts` / menu day payload (meal title from Sanity or provider input).
- **`warmDishBankSeeds.ts`** — inert suggestions for menu profile registry only; not runtime source today.
- **Norwegian seed** in Sanity for pilot providers.

### 5. What happens when UI language is Italiano?

| Behavior | Result |
|----------|--------|
| Sidebar, dashboard labels, settings chrome | Italian (`messages/it.json`) |
| Logout, nav items | Italian (after shell polish PR) |
| Category names (Påsmurt, Varmrett, …) | Still Norwegian |
| Fixed choice titles | Still Norwegian (catalog data) |
| Warm dish meal titles | Still Norwegian (content) |
| Menu profile cutover | **Not active** |

Provider-owned menu data is **intentionally not auto-translated** by UI locale.

### 6. What must G5 do?

G5 activates **`LP_MENU_PROFILE_RESOLVER`** (explicit env ON) to map **presentation only**:

- Resolve menu profile per provider/market (`lib/menu-profile/` resolver).
- Map `packageModel` / `fixedChoiceCategories` to provider workspace labels and available categories.
- Optional warm dish bank **preview** from profile seeds.
- **Do not** change order write-path, `/week`, publish, `menuDayPayload`, or existing orders without later explicit GO.

### 7. Risk matrix

| Change | Provider meny risk | `/week` risk | Publish risk | Orders risk | Catalog save risk |
|--------|-------------------|--------------|--------------|-------------|-------------------|
| G5a presentation only (flag ON) | Low — read path label swap | None if isolated | None if no payload change | None | None if save keys unchanged |
| G5b fixed choice model (flag ON) | Medium — category key mapping | High if keys leak to orders | High if publish schema changes | **Critical** if choice keys change | High — payload shape |
| G5c warm dish bank preview (flag ON) | Low — preview/suggestions only | None | Medium if conflated with publish | None | Low |
| G5d publish/order/week cutover | **Critical** | **Critical** | **Critical** | **Critical** | **Critical** |

**Golden Path:** Any change to `lp_order_set`, `menuDayPayload`, publish flow, or order choice keys is **out of scope** until explicit later phase.

---

## Recommended G5 phasing

### G5a — Provider menu workspace presentation only (behind flag)

- Wire `resolveMenuProfile()` into `/leverandor/meny` **display layer only**.
- Replace `CATEGORY_LABELS` fallback with profile-resolved labels when flag ON.
- Keep canonical category **keys** stable (`paasmurt`, etc.) for orders/publish.
- Files: `providerMenuWorkspace.ts`, provider meny page/components, resolver entry.

### G5b — Fixed choice category model (behind flag)

- Map profile `fixed_choice` categories to catalog presentation.
- Do **not** rename stored catalog keys or order choice keys without migration.
- Files: `lunchCategoryCatalog.ts`, `providerMenuTierContract.ts`, registry types.

### G5c — Warm dish bank preview (behind flag)

- Surface `warmDishBankSeeds` as **read-only suggestions** in varmrett editor.
- No auto-publish, no Sanity write, no slot mutation.

### G5d — Explicit later GO (NOT G5)

Blocked until separate approval:

- Publish cutover (`menuDayPayload`, menu-days API).
- `/week` employee presentation.
- Order write-path / choice key changes.
- Sanity sync/write runtime changes.

---

## Files reference

| Concern | Controlling files |
|---------|-------------------|
| Category keys & Norwegian labels | `lib/cms/menuDayContract.ts` |
| Tier → categories | `PLAN_CATEGORIES`, `PLAN_ORDER_CHOICE_KEYS` |
| Workspace presentation | `lib/provider-menu/providerMenuWorkspace.ts` |
| Catalog mapping | `lib/provider-menu/lunchCategoryCatalog.ts` |
| Fixed choice rows | `lib/provider-menu/providerMenuCatalogSurface.ts`, `providerMenuTierContract.ts` |
| Warm dish / Sanity slots | `mergeProviderMenuSlots.ts`, `providerMenuTierContract.ts` |
| Menu profile (inert) | `lib/menu-profile/registry.ts`, `warmDishBankSeeds.ts`, `featureFlag.ts` |
| UI chrome i18n | `messages/*.json`, `components/providers/ProviderNav.tsx` |

---

## Why i18n cannot fix this

UI locale switches **chrome strings** in message catalogs. Menu categories and dish titles are **tenant content** stored in Sanity/DB with Norwegian seed values. Translating them via `messages/*.json` would:

- Duplicate provider-editable content in 9 locales.
- Desync from catalog save/publish truth.
- Break order snapshots that store title at order time.

G5 profile cutover is the correct path: **market-aware presentation source-of-truth** behind flag, without touching order/publish contracts in early phases.

---

## Product model — UI language vs market/menu profile/currency (pre-G5a)

### A. UI language alone must NOT change

- Dish titles (`Ost & Skinke`, `Laks & Eggerøre`, …)
- Catalog choices
- Warm dish names
- Prices
- Currency display (kr / NOK)

UI locale (`lp_locale`, next-intl) translates **chrome only** — nav, settings labels, buttons.

### B. Provider market / menu profile / currency will later control

Owned by **catering provider** (not company/customer/employee):

- Fixed choices presentation
- Category labels in workspace
- Warm dish bank preview
- Default package model explanation
- Price display currency
- Suggested/default package prices

Sources: `provider_settings` (market, currency, menu_profile_id), `lib/menu-profile/registry.ts`, market defaults.

### C. G5a scope — workspace presentation only (behind flag)

| `LP_MENU_PROFILE_RESOLVER` | Behavior |
|----------------------------|----------|
| `false` (default) | Today's Norwegian workspace **100% unchanged** |
| `true` | Provider workspace may show profile-based category labels and package explanation |

G5a explicitly does **not** change:

- Save payload / catalog write shape
- Order choice keys
- Publish / `menuDayPayload`
- `/week` employee view
- Price calculation / `provider_price_rules` / `pricePreview`

### D. G5b / G5c / G5d

| Phase | Scope |
|-------|-------|
| **G5b** | Fixed choice category model behind flag — stable order keys |
| **G5c** | Warm dish bank preview behind flag — read-only suggestions |
| **G5d** | Publish / order / `/week` cutover — **separate explicit GO only** |

Provider settings now show read-only **Marked, valuta og menyprofil** diagnostic so admins understand why Italian UI still shows Norwegian menu + NOK until G5a+.
