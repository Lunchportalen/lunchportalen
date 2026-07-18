# PHASE 17MENU — Menu Choice Contract Audit

**Status:** AUTHORITATIVE AUDIT (pre-runtime cutover)  
**Date:** 2026-07-18  
**Baseline SHA:** `771a4207e9743fd232971eb95ecc27e45723a89d`

## Global counts (canonical)

| Dimension | Count |
|-----------|------:|
| Countries | 21 |
| Market food profiles | 21 |
| Locales | 24 |
| Base languages | 15 |
| Currencies | 11 |

## Sources inspected

| Source | Path / evidence |
|--------|-----------------|
| Runtime categories | `lib/cms/menuDayContract.ts` |
| Lunch category seed | `scripts/sanity/seed-lunch-categories-v2.ts` |
| Entitlements schema/seed | `supabase/migrations/20260710120000_provider_config_foundation.sql` |
| Menu profiles (inert) | `lib/menu-profile/registry.ts` |
| Order write | `app/api/orders/route.ts`, `lp_order_set` |
| ADR | `docs/engineering/ADR-019-global-menu-profile-provider-commercial-model.md` |
| G5 cutover | `docs/engineering/G5-menu-profile-cutover-plan.md` |

---

## Canonical package category keys (Phase 17)

| Canonical key | NO runtime (CMS) | NO order choice | NO entitlement seed (legacy) |
|---------------|------------------|-----------------|------------------------------|
| `sandwich` | `paasmurt` | `paasmurt` | `menu_category:paasmurt` |
| `salad_box` | `salat` / `salatboks` | `salatboks` | `menu_category:salat` |
| `warm_meal` | `varmrett` | `varmmat` | `menu_category:varmrett` + `auto_warm_meal` |
| `sushi` | `sushi` | `sushi` | `menu_category:sushi` |
| `poke_bowl` | `pokebowl` | `pokebowl` | `menu_category:pokebowl` |
| `thai` | `thai` / `thaimat` | `thaimat` | `menu_category:thai` |
| `enterprise_upgrade` | n/a (metadata) | **not orderable** | **missing from seed** |

Legacy Luxus-only CMS category `vegetarian` remains NO-specific until ownership decides merge into salad/sandwich dietary tags; not a global package category.

---

## Per-category audit

### sandwich / Påsmurt

| Field | Current |
|-------|---------|
| Category key | `paasmurt` (CMS/order) |
| Subchoices | `ost-skinke`, `laks-eggerore`, `kylling-karri`, `vegetar` |
| Package | BASIS + LUXUS + ENTERPRISE |
| SoT | Sanity `lunchCategory` items; published via `menuDay` |
| Runtime consumer | `/api/order/window`, `EmployeeWeekClient`, `lp_order_set` |
| Gaps | Norwegian variants only; no country-specific sandwich banks; entitlement table unused |
| Proposed canonical | category=`sandwich`; retain item keys; localize titles per country locale |

### salad_box / Salatboks

| Field | Current |
|-------|---------|
| Category key | CMS `salat` / lunchCategory `salatboks` / order `salatboks` |
| Subchoices | `skinke`, `kylling`, `vegetar` |
| Package | BASIS + LUXUS + ENTERPRISE |
| SoT | Sanity `lunchCategory` |
| Gaps | Key triple; no market-local salad styles |
| Proposed canonical | category=`salad_box`; NO adapter maps order `salatboks` |

### sushi

| Field | Current |
|-------|---------|
| Category key | `sushi` |
| Subchoices | Single composite `sushi-pakke` (no further user subchoice) |
| Package | LUXUS + ENTERPRISE only |
| Gaps | No invented subchoices; entitlement inert |
| Proposed canonical | category=`sushi`; single item unless provider publishes approved variants |

### poke_bowl / Pokébowl

| Field | Current |
|-------|---------|
| Category key | `pokebowl` |
| Subchoices | `laks`, `kylling`, `vegetar` |
| Package | LUXUS + ENTERPRISE |
| Gaps | Key not `poke_bowl`; no country-local proteins |
| Proposed canonical | category=`poke_bowl`; NO adapter `pokebowl` |

### thai / Thaimat

| Field | Current |
|-------|---------|
| Category key | CMS `thai` / order `thaimat` |
| Subchoices | `pad-thai-nudler`, `biff-peppersaus`, `pad-med-mamuang` |
| Package | LUXUS + ENTERPRISE |
| Gaps | Norwegian naming; generator uses `asian` |
| Proposed canonical | category=`thai`; NO adapter `thaimat` |

### warm_meal / Varmrett

| Field | Current |
|-------|---------|
| Category key | `varmrett` / order `varmmat` |
| Subchoices | From `mealIdea` bank → `menuDay.mealRef` (not lunchCategory items) |
| Package | All tiers; **one shared warm dish per provider/day** |
| Gaps | NO-only bank in Sanity; TS multi-country seeds inert |
| Proposed canonical | category=`warm_meal`; bank items require stable dish keys + allergens + locales |

### enterprise_upgrade

| Field | Current |
|-------|---------|
| Category key | Profile `enterprise_upgrade` (`kind: upgrade`) |
| Subchoices | Provider upgrade type/note on shared warm dish (UI validation) |
| Package | ENTERPRISE only |
| SoT | ADR-019 + `providerMenuPackageSurface` validation; **not** DB entitlements |
| Gaps | Not in `provider_package_entitlements` seed; not orderable choice_key |
| Proposed canonical | entitlement `enterprise_upgrade=true`; never an employee order category |

---

## Package matrix (contract)

| Package | Canonical categories |
|---------|----------------------|
| BASIS | `sandwich`, `salad_box`, `warm_meal` |
| LUXUS | BASIS + `sushi`, `poke_bowl`, `thai` |
| ENTERPRISE | LUXUS food categories + `enterprise_upgrade` metadata on shared `warm_meal` |

## Runtime enforcement today

| Layer | Enforced? |
|-------|-----------|
| Hardcoded `PLAN_ORDER_CHOICE_KEYS` | YES |
| `provider_package_entitlements` | NO (inert) |
| Locale switch changes entitlement | Must remain NO |

## Gaps blocking TECHNICAL_PASS

1. Entitlements unused at runtime  
2. No Sanity `countryCode` / market axis  
3. Non-NO universes not materialized  
4. Order snapshots missing market profile version / locale / full allergen identity  
5. Triple naming (CMS / order / generator / profile)  
6. Warm generation Melhus/NO-only  

## Proposed cutover rule

Ship canonical keys + Norway adapter first; dual-read entitlement keys (`menu_category:sandwich` preferred, legacy `paasmurt` accepted); never break Melhus golden path.
