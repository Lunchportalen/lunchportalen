# PHASE 15G — Global 21-country build status (honest)

**Branch:** `release/global-21-country-tax-legal`  
**Base SHA:** `9ef8d4af07319fe6bf6f6da9c4a3e5b215aaec0c`  
**Production:** unchanged (`98b3b15e…`, migration head `20260818120000`)  
**Pending NO-only migrate workflow `29464749465`:** NOT approved  

## What was built (this changeset)

- Additive migration `20260828120000_global_21_tax_legal_foundation.sql`
  - currencies (11)
  - jurisdictions hierarchy
  - tax_evidence / tax_rules / tax_categories / snapshots
  - market_commercial_models (5% commission, DRAFT)
  - market_invoice_requirements (e-invoice status RESEARCHED)
  - legal_packs + acceptances tables
  - market_build_readiness (all-or-nothing states)
- Fail-closed tax resolver (`lib/tax/engine/resolver.ts`)
- Money minor-unit helpers (`lib/money/minorUnits.ts`)
- 21 country tax pack registry with official primary-source URLs (`lib/tax/packs/countryTaxPacks.ts`)
- Commercial model + legal pack stubs + build readiness state machine
- Automated tests: fail-closed tax, 0 forged approvals, 21/24 coverage, no DRAFT→ACTIVE

## What is explicitly NOT done

| Gate | Status |
|------|--------|
| Human TAX_APPROVED × 21 | **0/21** — packs are RESEARCHED only |
| Human LEGAL_APPROVED × 21 | **0/21** |
| Native locale LEGAL_APPROVED × 24 | **0/24** (NO nb-NO NATIVE_REVIEWED stub only) |
| USA 50 states + DC SUPPORTED | **0/51** — all BLOCKED_MISSING_EVIDENCE |
| Canada provinces/territories SUPPORTED | **0/13** — all BLOCKED_MISSING_EVIDENCE |
| E-invoice integrations (Peppol/SdI/KSeF/…) | **Not implemented** — registry only |
| Staging 21-country Golden Path | **Not run** |
| Production cutover | **Forbidden in this phase** |

## Official sources used for research pointers

- European Commission VAT rates / TEDB: https://taxation-customs.ec.europa.eu/taxation/vat/vat-directive/vat-rates_en
- VIES: https://ec.europa.eu/taxation_customs/vies/
- National authority home pages linked per country in `COUNTRY_TAX_PACKS`
- HMRC VAT rates guidance (GB)
- CRA GST/HST business topic (CA)
- Streamlined Sales Tax (US reference only — not sufficient for launch)

## Decision posture

`BUILT_BUT_NOT_LEGALLY_APPROVED`

`GLOBAL_21_READY = NO` until 21/21 tax + legal + invoice approvals and subdivision coverage exist.
