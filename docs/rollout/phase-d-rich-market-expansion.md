# Phase D Rich Market Expansion

## Scope

Phase D adds a dormant, source-controlled rollout track for rich-market expansion.

This document is a risk register and control note only. It does not authorize production writes.

## Status

- Source-only: yes
- Production mutation: no
- Provider onboarding apply: no
- Generator apply: no
- Provider creation: no
- menuDays creation: no
- Catalog docs creation: no
- Publish: no
- SOT: no
- Auto-rollout: no
- Batch apply: no
- Publish-as-apply: no
- Customer-visible Phase D content: no

## Target Locales

| Order | Locale | Provider | Slug | Menu profile | Country | Currency | Timezone control | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `en-US` | US Lunch Pilot | `us-lunch-pilot` | `us_office_lunch` | US | USD | provider required, pilot default `America/New_York` | SOURCE_ONLY |
| 2 | `en-CA` | Canadian Lunch Pilot | `canadian-lunch-pilot` | `canadian_office_lunch` | CA | CAD | provider required, pilot default `America/Toronto` | SOURCE_ONLY |
| 3 | `nl-NL` | Dutch Lunch Pilot | `dutch-lunch-pilot` | `dutch_office_lunch` | NL | EUR | `Europe/Amsterdam` | SOURCE_ONLY |
| 4 | `nl-BE` | Belgian Dutch Lunch Pilot | `belgian-dutch-lunch-pilot` | `belgian_dutch_office_lunch` | BE | EUR | `Europe/Brussels` | SOURCE_ONLY |
| 5 | `fr-BE` | Belgian French Lunch Pilot | `belgian-french-lunch-pilot` | `belgian_french_office_lunch` | BE | EUR | `Europe/Brussels` | SOURCE_ONLY |
| 6 | `de-AT` | Austrian Lunch Pilot | `austrian-lunch-pilot` | `austrian_office_lunch` | AT | EUR | `Europe/Vienna` | SOURCE_ONLY |
| 7 | `de-CH` | Swiss German Lunch Pilot | `swiss-german-lunch-pilot` | `swiss_german_office_lunch` | CH | CHF | `Europe/Zurich` | SOURCE_ONLY |
| 8 | `fr-CH` | Swiss French Lunch Pilot | `swiss-french-lunch-pilot` | `swiss_french_office_lunch` | CH | CHF | `Europe/Zurich` | SOURCE_ONLY |
| 9 | `en-IE` | Irish Lunch Pilot | `irish-lunch-pilot` | `irish_office_lunch` | IE | EUR | `Europe/Dublin` | SOURCE_ONLY |
| 10 | `fr-LU` | Luxembourg Lunch Pilot | `luxembourg-lunch-pilot` | `luxembourg_office_lunch` | LU | EUR | `Europe/Luxembourg` | SOURCE_ONLY |
| 11 | `en-AU` | Australian Lunch Pilot | `australian-lunch-pilot` | `australian_office_lunch` | AU | AUD | provider required, pilot default `Australia/Sydney` | SOURCE_ONLY |
| 12 | `en-SG` | Singapore Lunch Pilot | `singapore-lunch-pilot` | `singapore_office_lunch` | SG | SGD | `Asia/Singapore` | SOURCE_ONLY |

## Market Risk Notes

### US

- State and local sales tax review is required before live apply.
- Provider timezone is required. The pilot default is only for source tests and dryRun planning.

### CA

- Province tax and timezone review is required before live apply.
- `fr-CA` is not included in this batch.
- Provider timezone is required. The pilot default is only for source tests and dryRun planning.

### BE

- Belgium requires dual-locale handling: `nl-BE` and `fr-BE`.
- EU VAT/compliance review is required before live provider apply.

### CH

- CHF market.
- Multilingual rollout requires `de-CH` and `fr-CH` coordination.
- Premium/enterprise positioning should be reviewed before live apply.

### LU

- Small multilingual enterprise market.
- EU VAT/compliance review is required before live provider apply.

### AU

- Provider timezone is required. The pilot default is only for source tests and dryRun planning.
- GST assumptions must be verified before any live provider apply.

### SG

- City-state market with SGD.
- High B2B value; GST/commercial assumptions must be verified before apply.

### EU/VAT

- EU markets require VAT/compliance review before live provider apply.
- No Phase D provider may be applied without a separate scoped GO.

## Controls

- Phase D targets are `SOURCE_ONLY`.
- Phase D targets must not be included in SOT, auto-rollout, batch apply, publish-as-apply, onboarding apply, or generator apply without a separate future GO.
- US, CA, and AU require explicit provider timezone before any future apply.
- Internal tier codes remain `BASIS`, `LUXUS`, and `ENTERPRISE`.
- Customer/provider tier labels are displayed through `lib/tiers/displayLabels.ts`.

## Next Action

Phase D remains NO-GO for live apply. The next action after review is to keep Phase D dormant while Phase C final readiness remains the launch decision gate.
