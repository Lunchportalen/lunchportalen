# ADR-020 — GLOBAL AGENCY COMMISSION MODEL

**Status:** Accepted (Phase 16NO owner decision)  
**Date:** 2026-07-17  
**Commercial model ID:** `agency_commission_invoice_only_v1`

## Context

Lunchportalen operates a multi-country catering coordination platform. The commercial
and legal operating model must be identical across all 21 launch countries. Local tax
treatment of the platform service may vary by country; the agency model must not.

## Decision

Applies to all 21 countries (NO, SE, DK, FI, GB, DE, FR, ES, IT, NL, BE, CH, AT, IE, PL, RO, CZ, PT, GR, US, CA):

1. The catering provider is the seller of the food.
2. The catering provider owns the menu and pricing.
3. The catering provider accepts the customer's order.
4. The catering provider supplies and delivers the food.
5. The catering provider invoices its own customer.
6. The catering provider is responsible for local food VAT/GST/sales tax.
7. Lunchportalen does not sell the food.
8. Lunchportalen does not invoice the catering provider's customer.
9. Lunchportalen does not collect customer funds.
10. Lunchportalen does not settle food sales.
11. Lunchportalen invoices the catering provider only.
12. Lunchportalen's fee is 5% of net order value excluding customer tax (`commission_rate_bps = 500`).
13. Tax on Lunchportalen's 5% service fee is country-specific.
14. Payment mode is `invoice_only`.
15. Stripe and card settlement are disabled.
16. Provider owns menus, prices, cutoff, customer access, packages/entitlements.
17. Provider cannot be a customer of itself.
18. Cross-tenant access is forbidden.
19. Commission calculations are immutable and auditable.
20. No country may override the underlying agency model.

### Canonical calculation

```
customer_net_order_amount = total before provider customer tax
platform_commission_net   = round(customer_net_order_amount * 0.05, minor units)
platform_service_tax      = country-specific tax on platform_commission_net only
platform_invoice_total    = platform_commission_net + platform_service_tax
```

Commission is never calculated on VAT/GST/sales tax, tips, refundable deposits,
cancelled orders, refunded quantities, voided invoices, or test orders.
Partial refunds proportionally reverse commission.

### Norway platform service tax (after accountant confirmation)

- Tax code: `NO_PLATFORM_SERVICE_STANDARD_VAT_25`
- Rate: 25% MVA on platform commission net
- Invoice wording: «Provisjon for tilgang til og bruk av Lunchportalen. 5 % av netto ordreverdi ekskl. merverdiavgift.»

### Country activation

- Country activation requires an approved tax profile for that country.
- Phase 16NO: only Norway may be production-enabled after accountant confirmation.
- Remaining 20 countries stay production-disabled with `pending_external_approval` tax profiles.
- External review for other countries may change local tax treatment, invoice wording,
  identifiers, registration/reporting, locale/legal text, and e-invoice requirements —
  not the agency model invariants above.

## Enforcement

- Typed configuration (`lib/markets/commercialModelInvariant.ts`)
- Runtime/API guards (`lib/markets/norwayFirstActivation.ts`)
- Database triggers on `country_production_activation`
- CI regression tests (`tests/markets/phase16noCommercialInvariant.test.ts`)
- Immutable commission snapshots + audit events
- Payment policy `invoice_only` / Stripe off

## Consequences

Any future change to these invariants requires:

1. A new ADR
2. Owner approval
3. Migration review
4. Financial regression tests
5. Country impact assessment
