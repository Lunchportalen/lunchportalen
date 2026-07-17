# PHASE 16NO — NORWAY LEGAL / PRIVACY GATE (inventory)

**Status:** `OWNER_APPROVED_NORWAY` pending full clickwrap productization  
**Accountant tax confirmation:** REQUIRED (separate gate)

## Required surfaces (operational portal)

| Document | Registry type | Norway locale | Current status |
|----------|---------------|---------------|----------------|
| Provider agreement | `provider_terms` | nb-NO | Structural stub / DRAFT — not forged LEGAL_APPROVED |
| Company/customer terms | `company_terms` | nb-NO | Structural stub / DRAFT |
| End-user terms | `employee_terms` | nb-NO | Structural stub / DRAFT |
| Privacy notice | `privacy_notice` | nb-NO | Structural stub / DRAFT |
| DPA | `dpa` | nb-NO | Structural stub / DRAFT |
| Cookie/consent | `cookie_notice` | nb-NO | Structural stub / DRAFT |
| Cancellation/refund | `cancellation_refund` | nb-NO | Structural stub / DRAFT |
| Allergen/food responsibility | `allergen_food_responsibility` | nb-NO | Structural stub / DRAFT |
| Invoice/payment terms | `invoice_payment_terms` | nb-NO | Structural stub / DRAFT |

Source: `lib/legal/legalDocumentRegistry.ts` · acceptance schema: `legal_acceptances`

## Model statements that must appear in Norway docs (owner-confirmed)

- Catering provider is seller of the food and invoices the customer
- Lunchportalen invoices only platform commission to the provider
- Lunchportalen does not collect food customer funds
- Provider responsible for menu, allergens, prices, and food MVA

## Enforcement today

- Onboarding: legacy `accepted_terms` boolean (not versioned checksum clickwrap)
- Versioned `legal_acceptances` table exists (15G.2) — wiring incomplete for full matrix
- Fiscal activation independently blocked by accountant gate

## Allowed launch posture for Norway docs

- `OWNER_APPROVED_NORWAY` for commercial model wording (owner confirmed 2026-07-17)
- `EXTERNAL_REVIEW_PENDING_GLOBAL` for other countries
- Do **not** mark documents `LEGAL_APPROVED` without external counsel evidence

## Gate result for cutover

| Check | Result |
|-------|--------|
| Owner commercial model confirmation | CONFIRMED |
| Accountant tax confirmation | REQUIRED |
| Versioned clickwrap fully productized | NOT COMPLETE |
| False LEGAL_APPROVED forged | NO |

**Implication:** Continue reversible prep and dark deploy. Do not enable real ordering/commission until accountant evidence is stored. Legal clickwrap hardening remains a parallel reversible track.
