# Global Billing Engine Implementation Contract

Status: foundation implemented, runtime cutover not enabled.

## Scope

This contract covers the new global provider commission and billing foundation:

- `markets` separates locale, country, currency, tax country, timezone, and public slug.
- `organization_billing_profiles` stores provider legal/billing truth.
- `payment_methods` stores provider payment method metadata only.
- `order_line_commercial_snapshots` stores immutable order-line commercial truth.
- `commission_rules`, `commission_ledger`, and `commission_periods` handle 5 percent commission and monthly close.
- `provider_commission_invoices` and `invoice_deliveries` snapshot recipients and delivery state.
- `billing_audit_log` records sensitive billing actions.

Existing `provider_invoices` remains the SaaS invoice track. Commission invoices use `provider_commission_invoices` to avoid blending SaaS subscription billing with commission settlement.

## Runtime Boundary

No automatic runtime wiring is enabled in the foundation migration.

Do not wire these objects into `lp_order_set`, menu publish, `/week`, cutoff, or provider order status until a dedicated Protected Golden Path audit is approved.

## Provider UI Contract

Provider billing UI should show:

- Billing status from `organization_billing_profiles.billing_status`.
- Billing email from `billing_email_current`.
- Verified admin recipient emails from `auth.users.email` joined through `provider_memberships`.
- Safe card metadata only: provider, brand, last4, expiry, status.
- Commission rate: 5 percent.
- Commission basis: net lunch sales excluding tax.
- Last provider commission invoice, payment status, recipient snapshot, and delivery statuses.

Provider billing UI must not show:

- Raw card number, CVV, provider webhook payloads, or secret IDs.
- Other providers' billing data.
- Mutable ledger controls.
- Employee-facing price, margin, commission, or tax internals.

## Superadmin UI Contract

Superadmin billing oversight should show:

- Provider billing profile and market.
- Commission ledger by provider, currency, period, event type, and idempotency key.
- Commission periods with close status and rounded amount.
- Commission invoices with recipient snapshots and delivery states.
- Payment status and retry/action-required state.
- Billing audit log.

Manual adjustments require:

- Actor user ID.
- Provider organization ID.
- Mandatory reason.
- Append-only ledger event, never mutation of prior ledger rows.
- Audit entry in `billing_audit_log`.

## Required Test Matrix

Unit tests:

- Commission exact calculation in minor units.
- Deterministic rounding for positive and negative correction events.
- Ledger idempotency key generation.
- Recipient snapshot de-duplication.
- Rejection of raw card data.
- Safe payment method display.

Database/RLS tests:

- `markets` exposes 21 configured locale/market rows.
- Provider admin can read own billing profile, payment metadata, invoices, and deliveries.
- Provider admin cannot read another provider's billing data.
- Provider admin can update billing email only through approved path.
- Provider admin cannot insert/update/delete commission ledger.
- Superadmin can read all billing data.
- Service role can write ledger, close periods, create invoices, and write delivery/audit rows.
- `commission_ledger` and `billing_audit_log` are append-only.
- Duplicate order completion, period close, invoice creation, and webhook events are idempotent.

Integration tests:

- Provider changes price after order: commission uses order-line snapshot.
- Completed/delivered order creates `ORDER_COMPLETED` ledger event.
- Cancelled/refunded order creates negative ledger event.
- Monthly close run twice returns same period.
- Invoice creation snapshots billing and admin emails.
- Billing email change affects future invoices only.
- Admin email change affects future invoices only.
- Payment failure and action-required states do not mark invoice paid.

Golden Path regression:

- `npm run test:golden-path`
- `node scripts/ci/guard-protected-golden-path.test.mjs`

Enterprise gates:

- `npm run typecheck`
- `npm run lint`
- `npm run build:enterprise`
- `npm run sanity:live`
