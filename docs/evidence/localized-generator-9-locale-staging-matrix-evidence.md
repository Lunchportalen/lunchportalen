# Localized fixed menu generator — 9-locale staging matrix evidence

**Status:** Evidence archived · docs-only · **staging matrix PASS**  
**Date:** 2026-07-05  
**Staging commit:** `bab39f148e1b93b5c4b25279023eab0a6952896e` (PR #420 generator runtime)  
**Main docs HEAD at archive time:** `b7acc5a2` — SOT rollout runbook (#422); **docs-only delta** vs staging deploy  
**Environment:** Staging — `https://staging.app.lunchportalen.no` · Sanity dataset **`staging`**  
**Operator:** Cursor agent (staging-only matrix; no production apply; no SOT; no auto-rollout)

This document records **verification evidence** for the 9-locale staging matrix executed before any SOT planning cutover or production rollout beyond the Melhus canary.

**No secret values, tokens, passwords, connection strings, or private tenant PII are recorded.**

---

## 1. Scope

| Item | State |
|------|-------|
| Environment | **Staging only** |
| Locales | **All 9** supported menu locales |
| Provider fixture | Melhus Catering AS · `11111111-1111-1111-1111-111111111111` |
| Apply mode | `create_missing_only_strict` · `categoryScope=all_supported` |
| Production apply | **NOT RUN** |
| Production Sanity mutation | **NONE** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Order write-path · `lp_order_set` | **NOT TOUCHED** |
| DB / RLS | **UNCHANGED** |

Each locale used a **distinct far-future week** (Mondays `2031-05-05` through `2031-06-30`) to avoid cross-locale draft collisions on staging.

---

## 2. Environment

| Field | Value |
|-------|-------|
| Staging URL | `https://staging.app.lunchportalen.no` |
| Deploy commit | `bab39f14` |
| Sanity dataset | `staging` |
| `LP_MENU_PROFILE_RESOLVER` | **ON** |
| `LP_LOCALIZED_FIXED_MENU_GENERATOR` | **ON** |
| Main HEAD (`b7acc5a2`) | Docs-only (#422 runbook); generator runtime equivalent to `325afbce` / `bab39f14` chain |

### 2.1 Preflight (staging)

| Check | Result |
|-------|--------|
| `/api/health` | **PASS** |
| Global vegetarian `lunchCategory` | **Present** |
| `paasmurt` / `varmrett` `displayOrder` | **1 / 7** (varmrett after sandwich) |
| `/api/week` (employee session) | **PASS** |
| `/api/order/window` (employee session) | **PASS** |
| Generator week-preview API | **200** · flags ON |

---

## 3. Locale matrix

| Locale | `menuProfileId` | Country | Currency | Week start | Result |
|--------|-------------------|---------|----------|------------|--------|
| nb-NO | `norwegian_company_lunch` | NO | NOK | `2031-05-05` | **PASS** |
| sv-SE | `swedish_lunch` | SE | SEK | `2031-05-12` | **PASS** |
| da-DK | `danish_office_lunch` | DK | DKK | `2031-05-19` | **PASS** |
| fi-FI | `finnish_office_lunch` | FI | EUR | `2031-05-26` | **PASS** |
| de-DE | `german_business_lunch` | DE | EUR | `2031-06-02` | **PASS** |
| en-GB | `uk_office_lunch` | GB | GBP | `2031-06-09` | **PASS** |
| fr-FR | `french_dejeuner` | FR | EUR | `2031-06-16` | **PASS** |
| es-ES | `spanish_menu_del_dia` | ES | EUR | `2031-06-23` | **PASS** |
| it-IT | `italian_office_lunch` | IT | EUR | `2031-06-30` | **PASS** |

**Method:** Staging-only `provider_settings` swap (locale · `menu_profile_id` · country · currency) per locale; restored after matrix.

---

## 4. Per-locale acceptance

For each locale the matrix verified:

- Correct **`menuProfileId`**, **country**, and **currency** via week-preview profile resolver
- **Category labels** follow provider `menuLocale` (package-card basis + dryRun catalog labels)
- **Fixed dish bank** titles localized (no Norwegian dish fallback on non-nb locales)
- **Allergens** present on generated choices / read-back menuDays
- **Employee-safe mapper:** no economy fields; no internal metadata in `employeeSafe` preview
- **Norwegian fallback forbidden** on non-nb locales (no Påsmurt / Salatboks / Varmrett / Ost & Skinke / Kylling karri in surface or employee-safe output)

### 4.1 Expected primary category labels (sandwich · salad · hotMeal · vegetarian)

| Locale | Expected labels |
|--------|-----------------|
| nb-NO | Påsmurt · Salatboks · Varmrett · Vegetar |
| sv-SE | Mackor · Sallader · Varmrätt · Vegetariskt |
| da-DK | Smørrebrød · Salater · Varm ret · Vegetarisk |
| fi-FI | Voileivät · Salaatit · Lämmin ruoka · Kasvis |
| de-DE | Belegte Brötchen · Salate · Warme Gerichte · Vegetarisch |
| en-GB | Sandwiches · Salads · Hot meals · Vegetarian |
| fr-FR | Sandwichs · Salades · Plats chauds · Végétarien |
| es-ES | Bocadillos · Ensaladas · Platos calientes · Vegetariano |
| it-IT | Panini · Insalate · Piatti caldi · Vegetariano |

**Authoritative label source:** `lib/menu-generator/localizedCategoryLabels.ts`

### 4.2 Representative localized dish-bank proof (hotMeal / sandwich samples)

| Locale | Sample dishes verified in preview or read-back |
|--------|------------------------------------------------|
| nb-NO | Kjøttkaker med potetmos og brun saus · Laks med agurksalat og poteter |
| sv-SE | Köttbullar med potatismos och lingon · Räksmörgås |
| da-DK | Frikadeller med kartofler og brun sovs · Smørrebrød med roastbeef |
| fi-FI | Lihapullat ja perunamuusi · Lohikeitto |
| de-DE | Schnitzel mit Kartoffelsalat · Bratwurst mit Sauerkraut |
| en-GB | Cottage pie · Fish and chips |
| fr-FR | Blanquette de veau · Jambon-beurre |
| es-ES | Pollo al ajillo · Bocadillo de tortilla |
| it-IT | Lasagne al forno · Panino prosciutto e mozzarella |

Non-nb locales: **no Norwegian-only dish titles** in applied week read-back.

---

## 5. DryRun / apply proof

Matrix sequence per locale: **dryRun → apply → Sanity read-back → second dryRun**.

| Check | Result |
|-------|--------|
| `supportedCategories` | **8/8** (all 9 locales) |
| `unsupportedCategories` | **`[]`** |
| `overwriteMode` | `create_missing_only_strict` |
| Catalog updates under strict mode | **NONE** |
| First apply | Created draft menuDays only |
| Read-back | **15** `menuDay` docs per week (5 weekdays × BASIS/LUXUS/ENTERPRISE) |
| Draft protection | `approvedForPublish=false` · `customerVisible=false` |
| Second dryRun `createdDraftDays` | **0** |
| Vegetarian catalog (post-first locale) | `would_skip_existing_category` (strict; no duplicate create) |
| Duplicates | **None observed** |
| Publish | **None** |
| Order count (Melhus staging) | **1 → 1** (unchanged) |

---

## 6. Employee safety

| Check | Result | Notes |
|-------|--------|-------|
| Locale override proof | **PASS** | Via `/api/provider/menu-generator/week-preview` **`employeeSafe`** — `menuLocale` matches provider settings regardless of employee UI locale cookie |
| `/api/week` + `lp_locale=en-GB` | **WARN / caveat** | Employee week API reflects **published** Sanity menu until localized content is published; not authoritative for unpublished generator drafts |
| Economy exposure | **NONE** | Forbidden fields absent from `employeeSafe` (price, currency, VAT/MVA, commission, margin, providerCost, billing, etc.) |
| Metadata exposure | **NONE** | No `menu_profile_id`, translation hashes, or approval metadata in employee-safe output |

**Authoritative mapper:** `lib/menu-generator/employeeSafeMapper.ts`

---

## 7. Safety regression

| Check | Result |
|-------|--------|
| Order count | **UNCHANGED** (1 → 1) |
| Order write-path | **NOT TOUCHED** |
| `lp_order_set` | **NOT TOUCHED** |
| DB / RLS | **UNCHANGED** |
| Production Sanity | **UNTOUCHED** |
| Production flags | **UNCHANGED** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |

---

## 8. Known caveats

1. **Staging deploy lag** — Matrix ran on `bab39f14`; main `b7acc5a2` is docs-only (#422). Generator runtime behavior matches production `325afbce` chain.
2. **Employee `/api/week` override** — Proof is limited to published menu surface until localized drafts are published; **`employeeSafe` week-preview** is the authoritative generator mapper proof.
3. **Strict-mode vegetarian catalog** — First locale apply may create provider-scoped vegetarian catalog on staging; subsequent locales skip under strict mode (expected).
4. **Production rollout** — Remains **gated** (Melhus production canary only; no broad production apply).
5. **SOT** — Remains **gated**; this matrix is a prerequisite evidence artifact, not authorization to cut over.

---

## 9. Decision

| Item | Verdict |
|------|---------|
| **9-locale staging matrix** | **PASS** |
| **SOT readiness** | **GATED** — matrix green; explicit operator **GO** required before SOT planning cutover |
| **Production rollout readiness** | **GATED** — no production apply beyond existing Melhus canary without separate **GO** |
| **Next step** | Archive this evidence → await explicit **GO** for SOT planning or additional production rollout |

**Do not** start SOT, start auto-rollout, or run production apply without explicit operator GO.

---

## 10. Related artifacts

| Document | Purpose |
|----------|---------|
| [`localized-generator-production-evidence.md`](./localized-generator-production-evidence.md) | Production canary + PR #420 dryRun evidence |
| [`../runbooks/localized-generator-sot-rollout-readiness.md`](../runbooks/localized-generator-sot-rollout-readiness.md) | SOT / rollout readiness plan (plan only) |

**Protected Golden Path impact:** None — order write-path, `lp_order_set`, and employee order flow unchanged.
