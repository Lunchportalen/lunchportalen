# Commercial inventory — Lunchportalen (ADR-017)

**Status:** R1 read-only audit + R2 inert skeleton + hardcode guard.  
**Not runtime truth.** Operational billing, orders, and agreements remain authoritative until explicit cutover ADRs.

Relates to: [architecture-decisions.md](./architecture-decisions.md) ADR-017.

---

## Executive summary

Lunchportalen is **NO-first commercial** today:

- Canonical tier prices: **90 / 130 / 170 NOK eks. mva** (`lib/menu-publish/tierPricing.ts`)
- Matmoms fallback: **`VAT_RATE = 0.15`**
- Display and integrations assume **NOK / kr** (`formatNok`, `Intl.NumberFormat("nb-NO", NOK)`)
- **Tripletex + norsk EHF (`0192:`)** are the live NO billing integration — not global billing truth
- **5 % provisjon** exists as display/strategic estimate (`LUNCHPORTALEN_COMMISSION_RATE`); no production commission ledger
- **`gross_only`** fallback can compute commission on **inkl. mva** — must not become global truth
- **`provider_price_rules.currency`** exists in DB but `loadProviderMenuPrices()` does not read currency
- **Order lines** (`subtotal_cents_ex_vat`, `vat_cents`, `gross_cents_inc_vat`) are a strong foundation

UI locale (`lp_locale`, next-intl) is **separate** from market/commercial config (ADR-017 D1).

Inert market catalog: `lib/commercial/marketConfigs.ts` (R2 — not imported by runtime).

---

## P0 findings — must not spread globally

| Finding | Location | Risk |
|---------|----------|------|
| `VAT_RATE = 0.15` as global fallback | `lib/menu-publish/tierPricing.ts` + consumers | Wrong tax outside NO food VAT |
| Hardcoded `NOK` / `formatNok` | `lib/providers/providerCustomerBilling.ts`, CFO, customer detail, Tripletex sync | Wrong currency display/export |
| Tripletex/EHF as de facto billing path | `lib/integrations/tripletex/**`, onboarding, cron outbox | Treated as global billing truth |
| `gross_only` commission on inkl. mva | `lib/providers/providerCustomerBilling.ts` | Commission on tax |
| `LUNCHPORTALEN_COMMISSION_RATE = 0.05` without ledger | Provider billing + menu margin panel | Production invoicing without policy/ledger |
| `suggestEhfEndpoint` → `0192:{orgnr}` | `lib/providers/providerCustomerBilling.ts` | NO-only e-invoice assumed global |

---

## P1 findings — before any new market

| Finding | Location | Notes |
|---------|----------|-------|
| Duplicated price sources | `tierPricing.ts`, `PLAN_PRICES_EX_VAT`, `unitPriceNOK()` | Drift risk |
| Agreement without currency/tax_basis | `price_per_meal_nok`, `price_per_employee` | Multi-market agreement unclear |
| Partial `provider_price_rules` resolver | `lib/providers/providerMenuPriceConfig.ts` | Reads `amount_ex_vat`, `vat_rate` only |
| `Europe/Oslo` + 08:00 cutoff | System-wide ops truth | Market timezone not modelled separately |
| `TIER_PRICE_CENTS` 9000/13000/17000 | Menu publish + smoke fixtures | NO seed cents |

---

## Safe foundations

- Order line ex/vat/gross cent fields (`lib/orders/projection.ts`)
- `sumOrderRevenueCents()` + `computeBillingBasis()` confidence model (`complete` / `gross_only` / `incomplete`)
- `provider_price_rules` + `provider_settings` seeded (ADR-016)
- Employee `/week` — no employer price in UI channel (`EmployeeWeekClient.tsx`)
- ADR-017 four-axis separation (locale ≠ menu culture ≠ market ≠ agreement)
- Inert `MARKET_COMMERCIAL_CONFIGS` (R2) — only NO `productionReady`

---

## Known NO-only integrations

- **Tripletex** — invoice sync, webhooks, onboarding provisioning, SaaS monthly cron, outbox processor
- **EHF** — `0192:` endpoint suggestion, `InvoiceMethod.EHF`
- **Onboarding** — Tripletex credit check consent, `currency: "NOK"` on complete

Do not wire these as default for SE/DK/DE/FR/ES/UK without market-specific integration profiles (ADR-017 D8).

---

## Do not spread globally

Per ADR-017 and R2 guard:

- Do not import `lib/commercial/marketConfigs.ts` from runtime billing/order/Tripletex paths
- Do not use `lp_locale` / `provider_settings.locale` to pick currency, VAT, commission, or menu culture
- Do not hardcode DE/FR/ES/UK VAT rates in runtime
- Do not enable non-NO markets in `MARKET_COMMERCIAL_CONFIGS` without legal sign-off
- Do not mutate historical orders, published menus, or locked invoice basis on config change

---

## Allowed legacy hardcodes (inventory guard)

The CI guard `scripts/ci/commercial-hardcodes-guard.mjs` tracks known occurrences in `app/`, `lib/`, `components/`:

| Pattern id | Intent |
|------------|--------|
| `NOK` | Currency literals |
| `formatNok` | NOK formatters |
| `VAT_RATE` | Matmoms constant |
| `vat_0_15` | 0.15 rate occurrences (high volume — allowlisted per line) |
| `cents_9000` / `cents_13000` / `cents_17000` | Tier price cents |
| `price_per_meal_nok` / `price_per_employee` | Agreement fields |
| `Tripletex` / `EHF` / `ehf_0192` | NO integrations |
| `COMMISSION_RATE` | 5 % constant |
| `gross_only` | Commission fallback mode |

Allowlist: `scripts/ci/commercial-hardcodes-allowlist.json`  
Update intentionally: `node scripts/ci/commercial-hardcodes-guard.mjs --update-allowlist`

---

## Roadmap (ADR-017)

| Phase | Status |
|-------|--------|
| R0 — ADR-017 | Merged |
| R1 — Read-only inventory | Done (this doc) |
| R2 — Inert skeleton + guard | Done |
| R3A — Inert money/tax display helper (`lib/commercial/moneyDisplay.ts`) | Done (not wired to runtime) |
| R3C — First runtime wiring: CTO revenue KPI (`CtoClient`) | Done (NO-only display) |
| R3 — Money/tax display helpers wired (broader) | Planned |
| R4 — Provider price settings market-ready | Planned |
| R5 — Commission policy skeleton (inert) | Planned |
| R6 — Commission ledger dry-run | Planned |
| R7 — Billing integration per market | Planned |
| R8 — Multi-market behind feature flag | Planned |

Menu culture profile follows a **separate** ADR/roadmap — not mixed here.
