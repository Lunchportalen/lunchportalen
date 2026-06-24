# ADR-019 — Global Menu Profile & Provider Commercial Model

**Status:** Proposed (docs only — **no runtime changes in this ADR**)  
**Date:** 2026-06-25  
**Owner:** Lunchportalen Engineering  
**Relates to:** ADR-016, ADR-017, ADR-018, [commercial-inventory.md](./commercial-inventory.md), [r4-provider-price-plan.md](./r4-provider-price-plan.md), [PROTECTED_GOLDEN_PATH.md](../PROTECTED_GOLDEN_PATH.md)

---

## Summary

Lunchportalen skal være en **global, leverandørstyrt SaaS-plattform** — ikke en norsk app med oversatt UI. Cateringfirmaer opererer i ulike land, valutaer og matvaner. Lunchportalen foreslår meny, varmretter, priser og risikoflagg, men **leverandøren eier beslutningen**.

Denne ADR-en låser den **10/10 globale arkitekturen** før implementering. All kodeendring skjer i **stagede faser (G0–G7)** bak feature flags og egne cutover-ADR-er. **Protected Golden Path skal aldri brytes implisitt.**

---

## 1. Context

### 1.1 Product intent

Lunchportalen skal støtte cateringfirmaer som selv styrer:

- menyprofil
- faste valg
- varmrettbank
- auto-/manuell publisering
- valuta
- egne pakkepriser
- marked/kommersiell profil
- produksjonsmodell innenfor Lunchportalen-regler

Samtidig skal Superadmin ha **én enkel global kontrollflate** for avtaler, valuta, provisjon, settlement og økonomisk risiko på tvers av Norge, Sverige, Danmark, Finland, Tyskland, Frankrike, Spania og UK/England.

### 1.2 Current state (read-only gap audit, 2026-06)

Dagens kode er en **sterk NO-pilot**, ikke global 10/10:

| Area | Current truth | Gap |
|------|---------------|-----|
| Menu categories | `PLAN_CATEGORIES` in `lib/cms/menuDayContract.ts` — hardcoded Norwegian categories as **global runtime truth** | No programmatic `MenuProfile` registry |
| Pricing | `lib/menu-publish/tierPricing.ts` — 90/130/170 NOK + `VAT_RATE = 0.15` as Golden Path fallback | Not provider/currency/agreement-scoped |
| Provider prices | `provider_price_rules` exists (ADR-016) with `currency` column — **display-only**, not order truth | Parallel price truths documented in R4 plan |
| Market config | `lib/commercial/marketConfigs.ts` — **inert skeleton** for 8 markets (ADR-017 R2) | Not wired to runtime |
| Commission | `LUNCHPORTALEN_COMMISSION_RATE = 0.05` in display/billing estimate | No `CommissionLedger`, no agreement-scoped rules |
| Agreements | `agreements` table — **customer company** operational contracts | No `ProviderAgreement` with currency/commission/menu profile |
| Order snapshots | Order lines have ex/vat/gross cents | No full `OrderCommercialSnapshot` with agreement version + menu profile |
| Settlement | Invoice engine for customer companies; Tripletex NO | No `ProviderSettlement` per currency/agreement version |
| Superadmin | Provider list (name, status, customer count) | No global commercial control surface or risk flags |

**Existing strengths to preserve:**

- Provider-scoped lunch catalog (Sanity `lunchCategory` + provider catalog editor)
- One shared warm dish per delivery day (Enterprise upgrade as metadata, not separate warm dish)
- Employee `/week` and order APIs are price-free (by design)
- Order line minor-unit pattern (`subtotal_cents_ex_vat`, `vat_cents`, `gross_cents_inc_vat`)
- ADR-017 four-axis separation (UI locale ≠ menu profile ≠ market ≠ agreement) — partially documented, not fully implemented

### 1.3 Protected Golden Path

The proven production pilot (menu publish → MSDI → employee `/week` → `lp_order_set` → provider production status) is **locked**. Any commercial or menu-profile work must not regress:

- `lp_order_set` price validation and write-path
- `lp_order_advance_status` and cutoff GUC path
- Employee cutoff after 08:00
- Provider scoping and order enrichment
- `/week` price-free contract

See [PROTECTED_GOLDEN_PATH.md](../PROTECTED_GOLDEN_PATH.md).

---

## 2. Decision

The following principles are **locked** for all future implementation.

### 2.1 Four separate layers — never mixed

| Layer | Controls | Examples | Must NOT control |
|-------|----------|----------|------------------|
| **A) UI language** | How the system speaks to the user | Buttons, tabs, help text, errors, onboarding, navigation | Menu logic, prices, VAT, commission, menu profile |
| **B) Menu profile** | Food logic | Fixed choices, categories, warm dish bank, package content, auto-generation, local food culture | UI language, commercial rules, currency |
| **C) Market** | Legal/commercial reality | VAT/MVA rules, invoice requirements, accounting integrations, agreement templates | UI language directly, menu suggestions directly |
| **D) Currency** | Monetary unit | Price display, package prices, settlement, invoices, commission amounts, financial reporting | Menu categories, UI strings |

Resolution chains must remain **explicit and separate**. `lp_locale`, `profiles.preferred_locale`, and `provider_settings.locale` resolve UI text only — never market, currency, VAT, commission, or menu profile.

### 2.2 Menu profile — provider-owned, programmatic

- **Only catering firm / provider** may select and change menu profile.
- **Customer companies and employees** must never control menu profile.
- Menu profile is a **data model**, not copy or UI strings.
- Menu profile drives:
  - fixed choice categories
  - package model (Basis / Luxus / Enterprise contents)
  - warm dish bank and warm dish rules
  - auto-generation and auto-publish validation rules
  - enterprise upgrade model (metadata on shared warm dish — not a separate warm dish)

**Norwegian firmalunsj is one profile — not global truth.**

Current `PLAN_CATEGORIES` behavior becomes the **NO seed profile** (`norsk-firmalunsj`), not a hardcoded global fallback without an explicit market resolver.

### 2.3 Packages — commercial tiers, profile-defined contents

Basis, Luxus, and Enterprise are **commercial packages**. What each package contains comes from the active menu profile:

- NO profile: `paasmurt`, `salatboks`, `varmrett` (Basis); + sushi, pokebowl, thaimat (Luxus/Enterprise)
- UK profile: `sandwiches`, `salads`, `hot_lunch` (Basis); + bowls, wraps (Luxus/Enterprise)
- FR profile: `sandwich_baguette`, `salade`, `plat_du_jour` (Basis); + quiche/tarte, dessert (Luxus/Enterprise)
- etc. per market seed profiles

**One shared main warm dish per delivery day** applies across all profiles and packages. Enterprise may receive upgrade/add-ons on the same warm dish — never a separate warm dish slot.

### 2.4 Currency — provider-scoped, agreement-locked

- Provider operates in their chosen currency (NOK, SEK, DKK, EUR, GBP).
- Currency is **provider-scoped** and **locked in active agreement version**.
- All monetary amounts stored in **minor units** (`amountMinor`) with explicit `currency` (ISO 4217).

### 2.5 Package prices — provider-set, Lunchportalen-suggested

- Provider sets prices for Basis, Luxus, Enterprise in chosen currency.
- Lunchportalen may suggest prices based on market, currency, menu profile, cost, margin, history, and competition.
- **Provider decides** final price. UI pattern: *"Lunchportalen foreslår: €12.90"* / *"Din pris: €13.50"*.
- Superadmin sees deviation without manual correction of every field.

### 2.6 Commission — 5 % currency-independent

- Lunchportalen takes **5 % commission** on relevant lunch revenue.
- Commission is **percentage-based**, not currency-based:

```ts
commissionAmountMinor = Math.round(orderTotalMinor * commissionRate);
// default commissionRate = 0.05
```

- Commission is calculated in **agreement currency** unless active agreement explicitly states otherwise.
- Commission rule is **provider-scoped and agreement-scoped** with explicit basis (`gross_sales` | `net_sales`) and tax handling.

### 2.7 Provider agreement — commercial contract truth

- Every provider must have an **active commercial agreement** (`ProviderAgreement`).
- Agreement locks: legal entity, org/VAT number, market, currency, tax mode, menu profile, package prices, commission rate/basis, payment terms, terms/DPA versions, and operational responsibilities.
- **Agreement versioning is mandatory.** New version on change of: currency, market, menu profile (when it affects packages/prices), package prices, commission, tax mode, payment terms, terms, DPA, or offered packages.
- Historical questions must be answerable: *What currency applied in March? What Basis price when order was placed? Which agreement version backed the invoice?*

**Provider agreements are separate from customer company agreements** (`agreements` table). Customer agreements govern employee tier, delivery days, and cutoff per company. Provider agreements govern Lunchportalen–provider commercial terms.

### 2.8 Order snapshots — immutable commercial and menu facts

Every order must eventually store truth **as it was when the order was placed**:

- **OrderCommercialSnapshot:** agreement id/version, market, currency, package key, unit/line totals, commission rate/amount, tax mode/label
- **OrderMenuSnapshot:** menu profile id, category key, item key, titles

**Never** look up today's price, menu profile, or currency for historical orders, invoices, or commission.

### 2.9 Settlement — per provider, period, currency, agreement version

- `ProviderSettlement` aggregates gross/net sales and commission for a period.
- Status flow: `draft` → `approved` → `invoiced` → `paid`.
- Superadmin sees totals, commission basis, 5 % calculation, currency, agreement version, invoice status, and deviations.

### 2.10 Superadmin — global control surface

Superadmin must have **one simple overview** per provider:

| Provider | Land | Valuta | Menyprofil | Provisjon | Avtale | Status |
|--------|------|--------|------------|-----------|--------|--------|

Plus: package prices, Lunchportalen price suggestions, risk flags, settlement status, accounting adapter status.

Dashboard shows **two economic levels:**

1. **Local currency** — legal/invoice currency (what provider owes)
2. **Internal report currency** — converted estimate for management (e.g. NOK or EUR) — **display only**, never contract/invoice truth

### 2.11 Visibility — employees and customer companies

Employees and customer companies must **never** see:

- Lunchportalen commission, margin, provider cost, pricePreview
- Agreement terms, agreement version, settlement
- VAT/MVA setup, Superadmin risk flags, accounting integration
- Provider internal pricing or commercial agreement data

They see **order-relevant menu and order status only**.

Employees and customer companies must **never** change: menu profile, currency, package prices, commission, publish rules, warm dish bank, fixed choices, or provider catalog.

### 2.12 Auto-publish and manual publish

**Auto-publish** must validate before publishing:

- selected menu profile, currency, provider package prices
- Lunchportalen price suggestions and margin thresholds
- warm dish rules (one shared warm dish per day)
- allergen rules where required
- active agreement and agreement version
- complete week plan

Auto-publish **must not publish** if validation fails (missing warm dish, menu profile, currency, package price, agreement, or margin below blocked level).

**Manual publish** gives provider full control. Lunchportalen suggests; provider decides. Manual publish still validates against active menu profile and agreement version.

---

## 3. Non-negotiable constraints

These constraints override convenience and speed. Violation → **STOP**.

| # | Constraint |
|---|------------|
| N1 | **Do not break Protected Golden Path** — no implicit changes to `lp_order_set`, MSDI materialization, cutoff, or provider status flow |
| N2 | **Do not change `lp_order_set` without a dedicated cutover ADR** (e.g. R4H or successor) |
| N3 | **Do not change `/week` employee price-free contract** — no price, currency, VAT, commission, or commercial fields in employee UI or APIs |
| N4 | **Do not expose commercial data to employees or customer companies** |
| N5 | **Do not make Tripletex/EHF global accounting truth** — NO-specific integration only until per-market adapters exist |
| N6 | **Do not use Norwegian menu profile as global runtime fallback** without explicit market resolver and feature flag |
| N7 | **Do not overwrite historical orders** when price, currency, menu profile, or commission changes |
| N8 | **Do not mutate customer agreement lifecycle** (frozen company lifecycle P16) when adding provider commercial agreements |
| N9 | **Do not wire inert domain types into runtime** until explicit phase gate (G0 → G7) |
| N10 | **Do not enable new markets** without legal/accounting validation and Superadmin workflow |

---

## 4. Target architecture

### 4.1 Menu domain

```ts
type MenuProfile = {
  id: string;
  market: "NO" | "SE" | "DK" | "FI" | "DE" | "FR" | "ES" | "UK";
  locale: string;
  name: string;
  description?: string;

  fixedChoiceCategories: MenuCategoryDefinition[];

  packageModel: {
    basis: MenuPackageDefinition;
    luxus: MenuPackageDefinition;
    enterprise: MenuPackageDefinition;
  };

  warmDishBank: WarmDishDefinition[];
  warmDishRules: WarmDishRuleSet;
  autoPublishRules: AutoPublishRuleSet;
  enterpriseUpgradeModel?: EnterpriseUpgradeDefinition;
};
```

| Component | Role |
|-----------|------|
| **`MenuProfileRegistry`** | Read-only registry of seed profiles per market; NO profile mirrors current `PLAN_CATEGORIES` |
| **`fixedChoiceCategories`** | Profile-scoped category keys — not global hardcode |
| **`packageModel`** | Which categories each tier includes |
| **`warmDishBank`** | Profile-scoped warm dish suggestions |
| **`warmDishRules`** | One shared warm dish per day; Enterprise upgrade rules |
| **`autoPublishRules`** | Validation gates for auto-publish |
| **`enterpriseUpgradeModel`** | Metadata on shared warm dish — not separate warm dish slot |

**Resolver (future):** `getMenuProfileForProvider(providerId)` → active agreement's `menuProfileId` → registry entry. Fallback to NO seed only when resolver explicitly configured for NO market.

### 4.2 Commercial domain

```ts
type ProviderCommercialSettings = {
  providerId: string;
  market: "NO" | "SE" | "DK" | "FI" | "DE" | "FR" | "ES" | "UK";
  currency: "NOK" | "SEK" | "DKK" | "EUR" | "GBP";
  taxLabel: "MVA" | "VAT" | "MOMS" | "MWST" | "IVA" | string;
  taxMode: "exclusive" | "inclusive";
};

type ProviderPackagePrice = {
  providerId: string;
  packageKey: "basis" | "luxus" | "enterprise";
  amountMinor: number;
  currency: string;
  source: "provider_set" | "lunchportalen_suggested" | "contract_default";
  effectiveFrom: string;
};

type SuggestedPackagePrice = {
  providerId: string;
  packageKey: "basis" | "luxus" | "enterprise";
  suggestedAmountMinor: number;
  currency: string;
  estimatedCostMinor?: number;
  estimatedMarginPct?: number;
  confidence: "low" | "medium" | "high";
  reason: string;
};

type ProviderCommissionRule = {
  providerId: string;
  agreementId: string;
  agreementVersion: number;
  commissionRate: number; // default 0.05
  currency: "NOK" | "SEK" | "DKK" | "EUR" | "GBP";
  basis: "gross_sales" | "net_sales";
  taxHandling: "exclusive" | "inclusive";
};

type Money = {
  amountMinor: number;
  currency: string;
};
```

All money values: **minor units + currency + tax basis metadata** where relevant.

### 4.3 Agreement domain

```ts
type ProviderAgreement = {
  id: string;
  providerId: string;
  legalEntityName: string;
  organizationNumber?: string;
  vatNumber?: string;
  market: "NO" | "SE" | "DK" | "FI" | "DE" | "FR" | "ES" | "UK";
  currency: "NOK" | "SEK" | "DKK" | "EUR" | "GBP";
  taxMode: "exclusive" | "inclusive";
  taxLabel: string;
  menuProfileId: string;
  commissionRate: number;
  commissionBasis: "net_sales" | "gross_sales";
  commissionCurrency: string;
  packagePrices: { basis: Money; luxus: Money; enterprise: Money };
  billingCycle: "monthly";
  paymentTermsDays: number;
  contractStartDate: string;
  bindingMonths: number;
  noticeMonths: number;
  termsVersion: string;
  dpaVersion: string;
  status: "draft" | "pending" | "active" | "suspended" | "terminated";
  signedAt?: string;
  signedBy?: string;
};

type ProviderAgreementVersion = {
  agreementId: string;
  version: number;
  validFrom: string;
  validTo?: string;
  changedBy: string;
  changeReason: string;
  snapshot: ProviderAgreement;
};

type MarketAgreementTemplate = {
  market: "NO" | "SE" | "DK" | "FI" | "DE" | "FR" | "ES" | "UK";
  locale: string;
  defaultCurrency: string;
  taxLabel: string;
  taxMode: "exclusive" | "inclusive";
  defaultPaymentTermsDays: number;
  defaultCommissionRate: number; // 0.05
  termsVersion: string;
  dpaVersion: string;
  defaultMenuProfileId: string;
  supportedMenuProfileIds: string[];
  invoiceTextTemplate: string;
  legalPlaceholders: Record<string, string>;
};
```

**Signed agreement state** is explicit — no commercial operations without `status: active` and valid version.

### 4.4 Order and settlement domain

```ts
type OrderCommercialSnapshot = {
  orderId: string;
  providerId: string;
  agreementId: string;
  agreementVersion: number;
  market: string;
  currency: string;
  menuProfileId: string;
  packageKey: "basis" | "luxus" | "enterprise";
  categoryKey: string;
  itemKey?: string;
  itemTitle: string;
  mealTitle?: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  commissionRate: number;
  commissionAmountMinor: number;
  taxMode: string;
  taxLabel: string;
};

type OrderMenuSnapshot = {
  orderId: string;
  menuProfileId: string;
  categoryKey: string;
  itemKey?: string;
  itemTitle: string;
  mealTitle?: string;
  warmDishShared: boolean;
  enterpriseUpgradeType?: string;
};

type ProviderSettlement = {
  providerId: string;
  agreementId: string;
  agreementVersion: number;
  periodStart: string;
  periodEnd: string;
  currency: string;
  grossSalesMinor: number;
  netSalesMinor: number;
  commissionRate: number;
  commissionAmountMinor: number;
  status: "draft" | "approved" | "invoiced" | "paid";
};

type CommissionLedgerEntry = {
  id: string;
  providerId: string;
  agreementId: string;
  agreementVersion: number;
  orderId?: string;
  settlementId?: string;
  periodStart?: string;
  periodEnd?: string;
  basisAmountMinor: number;
  commissionRate: number;
  commissionAmountMinor: number;
  currency: string;
  basis: "gross_sales" | "net_sales";
  policyId: string;
  createdAt: string;
};
```

### 4.5 Superadmin domain

| Surface | Purpose |
|---------|---------|
| **Global provider agreement dashboard** | One table: provider × market × currency × menu profile × prices × commission × agreement × status |
| **Risk flags** | Missing currency/profile/price/agreement; price below minimum; commission deviation; overdue invoice; orders without snapshot |
| **Local + report currency split** | Invoice truth in local currency; management estimate in report currency (clearly labeled) |
| **Agreement/version overview** | Active version, history, who changed what and when |
| **Settlement overview** | Per provider/period/currency status and export |

**Superadmin workflow (target):**

1. Select provider → select market
2. System suggests: currency, tax label, agreement template, payment terms, commission 5 %, default menu profile
3. Superadmin reviews provider menu profile and package prices
4. Lunchportalen shows price suggestions and margin
5. Superadmin sees risk flags → approves commercial agreement
6. Provider signs/accepts → agreement version becomes active
7. Orders use active agreement snapshot; settlement and commission generate automatically

---

## 5. Market support

Minimum markets at launch of global model:

| Market | Currency | Default menu profile | Tax label (seed) |
|--------|----------|----------------------|------------------|
| **NO** | NOK | Norsk firmalunsj | MVA |
| **SE** | SEK | Svensk lunch | Moms |
| **DK** | DKK | Dansk frokost/lunsj | Moms |
| **FI** | EUR | Finnish office lunch | ALV |
| **DE** | EUR | German business lunch | USt |
| **FR** | EUR | French déjeuner | TVA |
| **ES** | EUR | Spanish menú del día | IVA |
| **UK** | GBP | UK office lunch | VAT |
| **IT** | EUR | Italian office lunch (`italian_office_lunch`) | IVA |

Each market has:

- `MarketAgreementTemplate` with legal placeholders and default commercial terms
- At least one seed `MenuProfile` with market-appropriate fixed choices, package model, and warm dish bank
- Entry in inert `MARKET_COMMERCIAL_CONFIGS` (ADR-017 R2) — enabled only after legal sign-off per market

**NO remains production-ready first.** Other markets require `productionReady: true` only after validation — not before.

---

## 6. Migration strategy (G0–G7)

All phases are **sequential and gated**. No phase may skip Golden Path review where order/pricing/publish paths are touched.

### G0 — Inert domain types + registry

**Scope:** Types and read-only registry files under `lib/menu-profile/` and extended `lib/commercial/` — **not imported by `app/`, `app/api/`, Golden Path, or publish flow.**

| Deliverable | Notes |
|-------------|-------|
| `MenuProfile` types + `MenuProfileRegistry` | NO seed = current `PLAN_CATEGORIES` behavior |
| Commercial/agreement/settlement types | As defined in §4 |
| Market agreement template seeds | Inert data only |
| CI guard | Block runtime imports from inert modules until explicit allowlist |

**Golden Path impact:** None.

**G0.1 (merged extension):** Add **IT** / EUR / `it-IT` / `italian_office_lunch` to inert registry and market defaults — no runtime wiring.

**G0.2 (merged extension):** Inert warm dish bank seeds in `lib/menu-profile/warmDishBankSeeds.ts` — canonical seed data per profile/market (5 dishes × 9 profiles). **Not** published `menuDay` documents. Sanity `mealIdea` materialization deferred to later G-phase (existing `mealIdea` schema remains runtime-bound; no prod Sanity write in G0.2).

### G1 — MenuProfile registry + NO seed

**Scope:** Provider selects `menuProfileId`; resolver behind **`LP_MENU_PROFILE_RESOLVER`** feature flag (default `false`).

| Deliverable | Notes |
|-------------|-------|
| DB column or `provider_settings` field for `menu_profile_id` | Additive |
| `getMenuProfileForProvider()` | Flag off → current hardcoded behavior unchanged |
| Flag on → read from registry via active agreement (when G2 exists) or provider setting |

**Golden Path impact:** None until flag on and resolver wired to publish/order paths (G7).

### G2 — Provider commercial agreement schema

**Scope:** Additive tables only — no mutation of customer `agreements` or frozen company lifecycle.

| Table (conceptual) | Purpose |
|--------------------|---------|
| `provider_agreements` | Commercial contract header |
| `provider_agreement_versions` | Immutable version snapshots |
| `provider_package_prices` | Version-scoped or effective-dated prices |
| `market_agreement_templates` | Seed templates per market |

**Golden Path impact:** None — schema only, no runtime reads.

### G3 — Superadmin read-only dashboard

**Scope:** Global commercial control surface — **read-only first**, no write actions.

| Deliverable | Notes |
|-------------|-------|
| Provider commercial overview table | Market, currency, profile, prices, commission, agreement, status |
| Risk flags display | From §4.5 / spec risk list |
| Local + report currency columns | Report currency clearly labeled estimate |

**Golden Path impact:** None.

### G4 — Price suggestion engine (inert / read-only)

**Scope:** Server-side `SuggestedPackagePrice` computation; provider UI may show suggestions.

| Deliverable | Notes |
|-------------|-------|
| Suggestion service | Market, profile, cost, margin inputs |
| Provider UI | "Lunchportalen foreslår" / "Din pris" |
| No runtime pricing cutover | `tierPricing.ts` and Golden Path unchanged |

**Golden Path impact:** None.

### G5 — Order commercial/menu snapshot (additive)

**Scope:** Attach snapshot records at order write time **without changing existing pricing validation truth**.

| Deliverable | Notes |
|-------------|-------|
| `order_commercial_snapshots` / `order_menu_snapshots` tables | Additive |
| Write hook at or after `lp_order_set` | **Additive columns/RPC extension only** — requires dedicated cutover ADR before changing validation |
| Backfill | Not required for historical orders |

**Golden Path impact:** Additive only in G5; **pricing validation unchanged** until G7 GO.

### G6 — Settlement + commission ledger

**Scope:** `ProviderSettlement` and `CommissionLedgerEntry` — compute and store; invoice generation per market adapter.

| Deliverable | Notes |
|-------------|-------|
| Period aggregation job | Per provider/currency/agreementVersion |
| Commission ledger | Audit trail with policy id |
| Superadmin approval flow | draft → approved → invoiced → paid |

**Golden Path impact:** None on order write; settlement reads snapshots.

### G7 — Runtime cutover behind flags

**Scope:** Move Golden Path pricing and publish validation to agreement-scoped resolver — **only after dedicated GO ADR** (extends ADR-018 / R4H).

| Precondition | Gate |
|--------------|------|
| G0–G6 complete for NO pilot | Required |
| `npm run test:golden-path` green | Required |
| Parity tests: old vs new resolver | Required |
| Employee price-free tests green | Required |
| Owner sign-off on cutover runbook | Required |

| Flag (conceptual) | Effect |
|-------------------|--------|
| `LP_MENU_PROFILE_RESOLVER` | Menu categories from profile registry |
| `LP_PROVIDER_PRICE_MARKET_RESOLVER` | Display prices from agreement (ADR-018) |
| `LP_ORDER_COMMERCIAL_SNAPSHOT` | Write snapshots at order time |
| `LP_GOLDEN_PATH_AGREEMENT_PRICING` | MSDI/`lp_order_set` use agreement-scoped prices |

**Golden Path impact:** **High** — requires Protected Golden Path Impact declaration, regression tests, rollback plan.

---

## 7. Consequences

### 7.1 Positive

- **Global-ready** architecture without rewriting NO pilot from scratch
- **Superadmin-controllable** commercial operations across markets
- **Finance/audit safe** — agreement versioning, snapshots, ledger
- **No historical mutation** — price/currency/profile changes apply forward only
- **Provider-owned** menu, currency, and pricing decisions
- **Employee UI protected** — commercial data never leaks to `/week`
- **Clear separation** from ADR-017 four-axis model — menu profile elevated from "suggestion weighting" to full programmatic model

### 7.2 Tradeoffs

- **More data model complexity** — provider agreements, versions, snapshots, ledger
- **Agreement versioning required** — every commercial change needs audit trail
- **Careful cutover** — parallel price truths until G7 GO
- **Staged rollout** — dual maintenance between hardcoded NO paths and resolver paths during G0–G6
- **Legal validation per market** — templates are seeds, not legal advice
- **Superadmin UX investment** — simplicity is first-class, not an afterthought

### 7.3 Relationship to existing ADRs

| ADR | Relationship |
|-----|--------------|
| **ADR-016** | `provider_price_rules` / `provider_settings` become inputs to agreement-scoped pricing — not standalone global truth |
| **ADR-017** | Four-axis model preserved; ADR-019 **supersedes** "menu culture profile" as lightweight suggestion-only concept — full `MenuProfile` is authoritative for menu logic |
| **ADR-018** | R4G display cutover is subset of G4/G7; Golden Path pricing cutover is G7 / R4H |

---

## 8. Current gaps (known — do not fix in this ADR)

| Gap | Location / evidence |
|-----|---------------------|
| `PLAN_CATEGORIES` hardcoded as global truth | `lib/cms/menuDayContract.ts` |
| `tierPricing.ts` NOK / 15 % MVA fallback | `lib/menu-publish/tierPricing.ts` |
| No `MenuProfile` data model or registry | No `menuProfile` / `MenuProfile` in codebase |
| No `ProviderAgreement` with currency/commission/profile | Customer `agreements` only |
| No `OrderCommercialSnapshot` with agreement/menu profile | Order lines have price cents only |
| No `ProviderSettlement` / commission ledger | Display estimate only |
| Superadmin lacks global commercial dashboard | `loadSuperadminProviderList` — name/status/count only |
| Parallel pricing truths | Documented in [r4-provider-price-plan.md](./r4-provider-price-plan.md) |
| `marketConfigs.ts` inert — not runtime | ADR-017 R2 |
| Auto-publish does not validate agreement/profile/currency | Publish flow uses hardcoded tier/category rules |

---

## 9. Acceptance criteria

This ADR is **accepted** when:

- [ ] **No runtime changes** in the same PR as this ADR
- [ ] **Golden Path explicitly preserved** — N1–N10 constraints documented
- [ ] **NO current behavior** defined as seeded profile (`norsk-firmalunsj`), not global runtime truth
- [ ] **Superadmin simplicity** is a first-class requirement (§2.10, G3)
- [ ] **Staged implementation path** G0–G7 documented with gates
- [ ] **Employee price-free contract** explicitly protected (N3)
- [ ] **Provider vs customer agreement** separation explicit
- [ ] **Tripletex not global truth** explicit (N5)
- [ ] Owner acknowledges before any G1+ implementation begins

---

## 10. Do not implement yet

Until explicit phase gate:

- Import inert types from `app/` or order/publish/billing paths
- Replace `PLAN_CATEGORIES` globally without feature flag
- Change `lp_order_set`, `menuDayPayload`, auto-rollout, or Sanity sync/write
- Expose commission/margin/currency to employee or customer APIs
- Enable SE/DK/FI/DE/FR/ES/UK in production without legal sign-off
- Mutate customer agreement lifecycle or frozen onboarding
- Wire Tripletex as settlement engine for non-NO markets
- Retroactively update historical order prices or menu facts

---

## 11. Superadmin risk flags (reference)

Target flags for G3 dashboard:

| Flag | Severity |
|------|----------|
| Currency missing | Block |
| Menu profile missing | Block |
| Package price missing | Block |
| Package price below recommended minimum | Warn |
| Agreement not active | Block |
| Agreement missing signature | Block |
| Agreement version missing | Block |
| Commission rate deviates from 5 % | Warn |
| Commission basis missing | Block |
| VAT/MVA setup missing | Block |
| Settlement not approved | Warn |
| Invoice overdue | Warn |
| Orders without active agreement snapshot | Block |
| Orders without commercial snapshot | Warn |
| Orders without menu profile snapshot | Warn |
| Auto-publish active without complete week plan | Warn |
| Auto-publish active without valid menu profile | Block |
| UK/EU accounting adapter not configured | Info |
| Tripletex integration missing for NO | Warn |

---

## 12. References

- [architecture-decisions.md](./architecture-decisions.md) — ADR-001 through ADR-018
- [commercial-inventory.md](./commercial-inventory.md) — read-only audit
- [r4-provider-price-plan.md](./r4-provider-price-plan.md) — parallel price truths
- [r4-provider-price-cutover-runbook.md](./r4-provider-price-cutover-runbook.md) — R4G gates
- [PROTECTED_GOLDEN_PATH.md](../PROTECTED_GOLDEN_PATH.md) — order pilot lock

---

**End of ADR-019**
