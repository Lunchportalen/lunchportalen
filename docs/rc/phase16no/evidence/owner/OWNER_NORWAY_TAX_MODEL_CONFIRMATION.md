# OWNER_NORWAY_TAX_MODEL_CONFIRMATION

**Status:** CONFIRMED  
**Confirmed by:** Owner  
**Recorded at:** 2026-07-17T15:10:00.000Z  
**Scope:** Norway tax / invoice commercial model (owner confirmation)

## Confirmed statements

1. Cateringfirmaet er selger og fakturerer kunden.
2. Mat inklusive levering organisert av cateringfirmaet: 15 % MVA.
3. Lunchportalen fakturerer cateringfirmaet 5 % av netto ordreverdi ekskl. MVA.
4. Lunchportalens provisjon/plattformtjeneste: 25 % MVA.
5. Lunchportalen fakturerer ikke sluttkunden og mottar ikke betaling for matsalget.

## Explicit non-claims

- This is **owner** confirmation, not accountant confirmation.
- `ACCOUNTANT_NORWAY_TAX_CONFIRMATION` remains **REQUIRED**.
- Does **not** authorize production ordering or commission invoicing alone.

## Canonical amounts (for verification)

| Line | NOK |
|------|-----|
| Customer net excl. food MVA | 10 000,00 |
| Food MVA 15% | 1 500,00 |
| Customer gross | 11 500,00 |
| Platform commission net 5% | 500,00 |
| Platform MVA 25% | 125,00 |
| Platform invoice total | 625,00 |

Tax code: `NO_PLATFORM_SERVICE_STANDARD_VAT_25`
