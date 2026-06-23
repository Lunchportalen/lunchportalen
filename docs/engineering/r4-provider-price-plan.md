# R4 — Provider price settings market-ready (plan)

**Status:** R4A done · R4B done · R4C done · R4D done · R4E-1 done · R4E-2 done · **R4F done** (truth map + parity tests + cutover runbook; **no runtime cutover**). **Next: R4G** (market resolver behind flag — requires ADR-018 GO).  
**Relates to:** [architecture-decisions.md](./architecture-decisions.md) ADR-016, ADR-017 · [commercial-inventory.md](./commercial-inventory.md)

This document formalizes how `provider_price_rules` can become market/currency/tax_basis-ready **without breaking today's NO production flow**. It is **not** operational truth until explicit cutover ADRs and phased gates pass.

---

## 1. Executive summary

- **`provider_price_rules`** (ADR-016) exists, is seeded (Melhus 90/130/170 NOK @ 15%), and is **partially wired** to provider menu **display only** via `loadProviderMenuPrices()`.
- **Golden Path, orders, MSDI materialization, and invoicing** still use **other price sources** (`tierPricing.ts`, `agreements.price_per_employee`, hardcoded tier maps).
- The system has **parallel price truths** that can drift; R4 must start with **documented plan + additive contracts**, not runtime cutover.
- **Employees must never see prices or commercial amounts** — not in UI, not in API JSON. `/week` was fixed in PR #304; this rule is non-negotiable for all R4 phases.

**Recommended direction:** Extend existing `provider_price_rules` additively (**A**) + compatibility read view (**C**). Do **not** introduce a v2 table unless index/migration risk blocks A.

---

## 2. Current state — `provider_price_rules`

**Definition:** `supabase/migrations/20260710120000_provider_config_foundation.sql`

### Fields today

| Field | Status |
|-------|--------|
| `provider_id` | NOT NULL, FK → organizations |
| `customer_id`, `agreement_id` | NULL — future overrides; **not used by resolver** |
| `tier`, `package_key` | BASIS / LUXUS / ENTERPRISE |
| `menu_category_key`, `menu_item_id` | NULL — future overrides |
| `amount_ex_vat` | numeric(12,2), > 0 |
| `currency` | default `NOK` — **in DB, not read by resolver** |
| `vat_rate` | 0–1 — read by resolver |
| `valid_from`, `valid_to` | exist — **not filtered by resolver** |
| `is_active` | filtered |
| `created_at`, `updated_at` | audit timestamps only |

### Missing (target for R4B+)

| Field | Purpose |
|-------|---------|
| `market_code` | Scope rule to market (default `NO`) |
| `tax_basis` | `ex_tax` / `inc_tax` display + resolver semantics |
| `tax_category` | e.g. food_standard vs SaaS |
| `source` | seed / admin / import |
| `created_by` | explicit audit actor |

### Seed (Melhus Catering AS)

Three tier-default rows: 90 / 130 / 170 NOK eks. mva @ 15%. Idempotent `ON CONFLICT DO NOTHING`.

### Runtime

| Role | Location | Notes |
|------|----------|-------|
| **Reader (only)** | `lib/providers/providerMenuPriceConfig.ts` → `loadProviderMenuPrices()` | service_role; tier defaults only; fallback `tierPricing.ts` |
| **Writer (app)** | **None** | seed/migration only |
| **RLS** | platform admin write; provider SELECT own rows; service_role full | runtime reader bypasses via admin client |

**Not used by:** agreement/onboarding, invoice engine, order write-path, employee APIs.

---

## 3. Operational truth today

| Concern | Operational truth | Notes |
|---------|-------------------|-------|
| **Golden Path / orders** | `menu_service_day_items.offered_price_cents_ex_vat` from `TIER_PRICE_CENTS`; validated by `lp_order_set` | **Critical — do not change in R4A–R4G** |
| **Provider menu display** | `provider_price_rules` → fallback `tierPricing.ts` | Display-only today |
| **Agreement / billing** | `agreements` columns + `price_per_employee`; `agreement_json` in registration pipeline | Separate from provider tier prices |
| **Invoice cron/engine** | Stored `agreements.price_per_employee` | Not `provider_price_rules` |
| **Employee** | Plan, menu, choice, order status, allergens, delivery info **only** | No price/commercial fields in UI or API (`GET /api/week` fixed PR #304; `/api/order/window` never exposed price) |

**Employee price rule (absolute):** If any employee-facing API later exposes `price_per_meal_nok`, `price_per_cuvert_nok`, currency, VAT, commission, or billing fields → treat as **security/API-contract risk**; fail-closed removal in a dedicated security PR. Never wire `moneyDisplay` or commercial resolver to `/week` or employee UI.

---

## 4. Resolver map

```
                    ┌─────────────────────────────────────────┐
                    │           PARALLEL PRICE SOURCES         │
                    ├──────────────┬──────────────┬───────────┤
                    │ tierPricing  │ provider_    │ agreements│
                    │ .ts 90/130/  │ price_rules  │ / JSON    │
                    │ 170 + 15%    │ (Melhus)     │           │
                    └──────┬───────┴──────┬───────┴─────┬─────┘
                           │              │             │
         ┌─────────────────┼──────────────┼─────────────┼─────────────────┐
         v                 v              v             v                 v
 syncMenuServiceDayItems  loadProvider   onboarding/   invoiceEngine    Tripletex
         │                 MenuPrices()   approval      cron             (NOK hardcoded)
         v                 │              │             │
 MSDI offered_price        GET menu-days  agreement     billing
         │                 (display)      seed
         v
 lp_order_set  ← Golden Path
```

| Path | Display-only? | Order/invoice critical? | Change first? |
|------|---------------|-------------------------|---------------|
| `loadProviderMenuPrices()` | Yes (provider menu UI) | No | **Safest** |
| Menu margin / 5% panel | Yes | No | **Safe** |
| `menuDayPayload` publish validation | Partial (gate only) | Indirect | Medium |
| `syncMenuServiceDayItems` + `TIER_PRICE_CENTS` | No | **Yes — Golden Path** | **Dangerous** |
| `lp_order_set` cents check | No | **Yes — Golden Path** | **Dangerous** |
| Onboarding complete (frozen A1.5) | No | Agreement seed | **Dangerous (frozen)** |
| Invoice cron / `invoiceEngine` | No | **Yes — billing** | **Dangerous** |
| Employee `/week`, `/api/order/window` | N/A | **Must stay price-free** | **Security** |

---

## 5. Proposed target model

Conceptual extension of `provider_price_rules` (not a migration in R4A):

```
provider_price_rules (extended)
├── provider_id
├── market_code          NEW — NOT NULL DEFAULT 'NO'
├── tier / package_key
├── amount_ex_vat        (existing; amount_minor optional later)
├── currency
├── tax_basis            NEW — 'ex_tax' | 'inc_tax'
├── tax_category         NEW
├── vat_rate             snapshot; vat_rate_id FK later
├── valid_from / valid_to
├── customer_id / agreement_id  (tier-2 overrides, future)
├── source               NEW
├── created_by           NEW
├── is_active
└── created_at / updated_at
```

### A vs B vs C

| Option | Verdict |
|--------|---------|
| **A — Extend `provider_price_rules`** | **Primary** — existing seed, RLS, ADR alignment |
| **B — New `provider_market_price_rules` v2** | Only if A blocked by index/migration risk |
| **C — Compatibility view** | **Combine with A** — e.g. `provider_price_rules_tier_defaults_v1` for legacy reader during R4D preview |

Future resolver hierarchy (ADR-017):

```text
market_code → tax_rate_rules (inert until R7+)
provider + market → provider_market_settings + provider_price_rules
company → agreement (operational tier/price for orders/billing)
order write → materialized cents on MSDI + lp_order_set (Golden Path)
```

---

## 6. Backward compatibility

| Rule | Action |
|------|--------|
| NO Melhus seed | Preserve 90/130/170 @ 15%; never UPDATE in cutover phases |
| `tierPricing.ts` fallback | **Keep** until R4H + Golden Path audit |
| Existing columns | Read as today; `market_code` defaults to `NO` when added |
| Order write-path | **No change** until R4H behind feature flag |
| Invoice generation | **No change** until R4G dry-run PASS |
| Provider menu runtime | **No switch** until R4E preview resolver + flag |
| Historical orders / MSDI / invoice lines | **Never mutate** on config change |
| Employee APIs | **Never** add price/commercial fields |

**Fail-closed:** Zero rows for `(provider_id, market_code='NO')` → identical to today (fallback `tierPricing.ts`).

---

## 7. R4 phased sequence

| Phase | Scope | Runtime impact |
|-------|-------|----------------|
| **R4A** | This plan + roadmap update | **None** |
| **R4B** | Additive migration: `market_code`, `tax_basis`, audit fields; compatibility view | **None** (defaults; resolver unchanged) |
| **R4C** | Market-scoped unique index + supplement seed `ON CONFLICT (provider_id, market_code, tier)` | **None** (same numbers; DO NOTHING) |
| **R4D** | `loadProviderMenuPricesPreview()` in `lib/providers/providerMenuPricePreview.ts` | **Done — test/diagnostics only; no runtime import** |
| **R4E** | Provider menu preview diagnostics **behind flag** | **Done** — API `pricePreview` + read-only strip; `prices` unchanged |
| **R4F** | Truth map + parity tests + cutover runbook | **Done** — docs/tests only; **no runtime cutover** |
| **R4G** | Market-aware production resolver v2 **behind `LP_PROVIDER_PRICE_MARKET_RESOLVER`** | Staging first; see [cutover runbook](./r4-provider-price-cutover-runbook.md) |
| **R4G-publish** | Align `menuDayPayload` with display resolver | Planned after or with R4G — dual-truth today |
| **R4G-billing** | Billing dry-run: agreement vs tier vs invoice | Dry-run only |
| **R4H** | MSDI sync + `lp_order_set` alignment **behind flag** | **Golden Path** — requires `test:golden-path`, protected-path guard, rollback plan |
| **R4F-agreement** | Agreement/onboarding alignment (not frozen onboarding) | Deferred — separate from resolver cutover |

Each phase must pass `ci:commercial-hardcodes-guard` without broad allowlist expansion.

---

## 8. Risk matrix

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Wrong price in menu editor (display drift) | Medium | Low (display-only today) | Source badge; keep fallback |
| Wrong price in agreement | Low–Medium | **High** | R4F separate; do not touch frozen onboarding |
| Wrong price in invoice basis | Low | **Critical** | R4G dry-run; cron untouched until validated |
| Dual truth: `tierPricing` ↔ `provider_price_rules` | **High (existing)** | Medium | Explicit resolver map; flag cutover only |
| Currency mismatch | Low (NO-only) | High at multi-market | Enforce market ↔ currency in R4D+ |
| VAT / tax_basis mismatch | Medium | High | View hardcodes 1.15; do not merge until tax resolver |
| Retroactive price change | Medium | **Critical** | `valid_from` + immutability; no MSDI rewrite |
| Provider override without audit | Medium | Medium | `source`, `created_by` before admin UI |
| RLS / cross-provider leakage | Low | **Critical** | Existing RLS + isolation tests on write UI |
| Golden Path regression | High if wrong order | **Critical** | R4H last; `test:golden-path` gate |
| **Employee price leak** | Low after #304 | **Critical** | Security contract tests; never add commercial fields to employee APIs |
| Tripletex hardcoded NOK | Low | Medium | R7 scope |

---

## 9. Do not implement yet

Explicit **out of scope** until later R4 phases with GO:

- Do **not** change `lp_order_set`, order write-path, or MSDI materialization (`syncMenuServiceDayItems`)
- Do **not** change invoice engine, Tripletex, or billing runtime
- Do **not** change `/week`, employee APIs, or employee UI (no price display ever)
- Do **not** wire `provider_price_rules` into billing or commission
- Do **not** activate multi-market or import `MARKET_COMMERCIAL_CONFIGS` in display/billing paths
- Do **not** remove `tierPricing.ts` fallback
- Do **not** run schema migration in **R4A**
- Do **not** change `loadProviderMenuPrices()` production behavior until R4D/E

---

## 10. Contract inventory (read-only)

Existing CI contracts (no R4A change):

| Check | Location |
|-------|----------|
| Melhus tier seed ≥ 3 rows | `scripts/ci/db-contracts.mjs` |
| Partial resolver reads tier defaults | `tests/lib/providers/providerMenuPackageSurface.test.ts` |
| Employee week API no commercial fields | `tests/api/week-profile-lookup.test.ts` (PR #304) |
| Commercial hardcode guard | `scripts/ci/commercial-hardcodes-guard.mjs` (1015 allowlisted) |

**R4B (done):** db-contracts verify market metadata columns; compatibility view `provider_price_rules_tier_defaults_v1`. **No runtime resolver.**

**R4C (done):** `provider_price_rules_provider_market_tier_default_uniq` replaces legacy `provider_price_rules_provider_tier_default_uniq`; supplement Melhus seed with `market_code='NO'`, `ON CONFLICT … DO NOTHING`. **No runtime resolver.** Employee price rule unchanged (PR #304).

---

## First safe PR after R4A

**R4D (done):** `loadProviderMenuPricesPreview()` — reads `provider_price_rules` base table with `market_code='NO'` and full metadata (`currency`, `tax_basis`, `tax_category`, `source`). Tests: `tests/lib/providers/providerMenuPricePreview.test.ts`, import guard `providerMenuPricePreview.guard.test.ts`. **No runtime import**; `loadProviderMenuPrices()` unchanged.

**R4E-1 (done):** `GET /api/provider/menu-days` returns optional `pricePreview` when `LP_PROVIDER_PRICE_PREVIEW_DISPLAY=true` (server env, default false). `prices` remains production truth from `loadProviderMenuPrices()`. Mapper: `toProviderMenuPricePreviewApiPayload()` in `providerMenuPricePreviewApi.ts`. No UI; no `queryError` exposed to client.

**R4E-2 (done):** `ProviderMenuPricePreviewStrip` in `/leverandor/meny` — renders when API returns `pricePreview` (flag on). `tierPrice`, margin, publish, tier tabs use `prices` only. Types: `providerMenuPricePreviewDisplay.ts` (client-safe).

**R4F (done):** Documented parallel price truths (see §11); parity/edge-case tests; [cutover runbook](./r4-provider-price-cutover-runbook.md); ADR-018. **No runtime cutover.**

**R4G next:** Market-aware `loadProviderMenuPrices` v2 behind `LP_PROVIDER_PRICE_MARKET_RESOLVER` — staging only until drift gates pass.

---

## 11. Price truth map (R4F — locked contract)

Five parallel truths exist today. **R4F does not merge them.** This map is the baseline for R4G+.

### A. Provider UI production prices

| Link | Detail |
|------|--------|
| Resolver | `loadProviderMenuPrices()` in `providerMenuPriceConfig.ts` |
| API | `GET /api/provider/menu-days` → `prices` |
| UI | `ProviderMenuBuilder.tierPrice` → `ProviderMenuCommandHeader`, `ProviderMenuStatusRow`, `ProviderMenuEditorPanel` margin |
| Query | Legacy: `provider_price_rules` without `market_code` filter; tier defaults; fallback `tierPricing.ts` (90/130/170 @ 15%) |
| Tests | `providerMenuPackageSurface.test.ts` — legacy contract |

### B. Preview diagnostics (not production)

| Link | Detail |
|------|--------|
| Resolver | `loadProviderMenuPricesPreview()` — market-aware `market_code='NO'`, scoped overrides |
| API | Optional `pricePreview` when `LP_PROVIDER_PRICE_PREVIEW_DISPLAY=true` |
| UI | `ProviderMenuPricePreviewStrip` — read-only; never affects margin/publish |
| Mapper | `toProviderMenuPricePreviewApiPayload()` — `differsFromProduction` vs `prices` |
| Tests | `providerMenuPricePreview.test.ts` |

### C. Server publish (dual truth — documented)

| Link | Detail |
|------|--------|
| Path | `buildMenuDayPayload()` → `fallbackProviderMenuPrices()` |
| Validation | Server `validateEnterprisePublish` uses fallback `priceExVatNok` — **not DB** |
| Gap | Client publish warnings use `tierPrice` from `prices` (A); server uses (C) |
| Fix phase | **R4G-publish** — not R4F |
| Tests | `menuDayPayload.test.ts` — R4F contract |

### D. Golden Path / MSDI (protected)

| Link | Detail |
|------|--------|
| Source | `TIER_PRICE_CENTS` in `tierPricing.ts` |
| Consumers | `syncMenuServiceDayItems`, `lp_order_set` |
| Rule | **Do not change** until R4H + protected-path audit |

### E. Billing / commercial (separate domain)

| Link | Detail |
|------|--------|
| Sources | `agreements.price_per_employee`, `lib/billing/pricing.ts`, Tripletex/invoice paths |
| Rule | Not driven by provider menu resolver; R4G-billing dry-run later |

---

## 12. Feature flags (R4F)

| Flag | Status | Rule |
|------|--------|------|
| `LP_PROVIDER_PRICE_PREVIEW_DISPLAY` | Implemented (R4E) | Diagnostics only — **must never change `prices`** |
| `LP_PROVIDER_PRICE_MARKET_RESOLVER` | **Documented only (R4F)** | Planned R4G cutover; default `false`; staging first |

**Do not reuse the preview flag for production cutover.**

---

## 13. R4F test inventory

| Test file | What it locks |
|-----------|---------------|
| `providerMenuPricePreview.test.ts` | Preview NO scope, override exclusion, mixed fallback, parity with production for normal rows |
| `providerMenuPackageSurface.test.ts` | Production legacy — no `market_code` filter; last row wins |
| `menuDayPayload.test.ts` | Server publish uses `fallbackProviderMenuPrices`, not resolver/preview |
| `week-profile-lookup.test.ts` | Employee `/api/week` — no commercial/price keys |
