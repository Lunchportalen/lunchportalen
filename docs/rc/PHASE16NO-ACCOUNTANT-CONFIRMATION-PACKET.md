# PHASE 16NO — ACCOUNTANT CONFIRMATION PACKET

**Status:** `ACCOUNTANT_NORWAY_TAX_CONFIRMATION = REQUIRED`  
**Date prepared:** 2026-07-17  
**Prepared for:** Lunchportalen AS accountant (written confirmation required)  
**Company:** Lunchportalen AS · org.nr 937155239

## Why this is required

No written accountant confirmation of the exact Norway tax/invoice model was found in
project evidence, email archives, or approved documentation. Owner discussion, AI
output, and source code are **not** accepted as accountant approval.

Real Norway production ordering and platform commission invoicing must not activate
until this confirmation is received and recorded.

## Exact model to confirm (yes/no on each)

1. The catering provider invoices its own customer for the food.
2. Food including provider-arranged delivery uses **15% MVA**.
3. An external transporter invoicing the catering provider uses **25% MVA** on the transport service.
4. Lunchportalen invoices the catering provider **5% of net sales excluding MVA**.
5. Lunchportalen applies **25% MVA** to its platform commission (service fee).
6. Lunchportalen does **not** invoice or collect payment from the food customer.

## Canonical calculation example

| Line | Amount (NOK) |
|------|--------------|
| Customer order excluding food MVA | 10 000,00 |
| Food MVA 15% (provider responsibility) | 1 500,00 |
| Customer gross (provider invoice) | 11 500,00 |
| Lunchportalen commission net (5% of 10 000) | 500,00 |
| Lunchportalen MVA 25% on commission | 125,00 |
| Lunchportalen invoice total | 625,00 |

Tax code: `NO_PLATFORM_SERVICE_STANDARD_VAT_25`  
Invoice wording:

> Provisjon for tilgang til og bruk av Lunchportalen.  
> 5 % av netto ordreverdi ekskl. merverdiavgift.

## Accepted evidence formats

- Written email from the accountant
- Signed document / PDF
- Accounting memorandum
- Formal confirmation stored in project evidence

## How to record confirmation (operator)

1. Store the evidence under `docs/evidence/accountant/` (no customer PII).
2. Record checksum, date, author, and exact approved model.
3. Set env/DB:
   - `ACCOUNTANT_NORWAY_TAX_CONFIRMATION=CONFIRMED`
   - `country_production_activation.accountant_tax_confirmation = 'CONFIRMED'` for `NO`
4. Only then enable Norway ordering/commission flags.

## Interim technical posture

- Reversible preparation continues (release branch, migrations rehearsal, dark deploy prep).
- Norway fiscal activation remains fail-closed.
- All other 20 countries remain production-disabled.
