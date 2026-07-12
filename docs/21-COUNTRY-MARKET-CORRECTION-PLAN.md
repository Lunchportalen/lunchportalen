# 21-COUNTRY MARKET CORRECTION PLAN

**Status:** Code + local migration complete on branch `fix/correct-21-country-market-model`.
**Production:** NOT migrated. Nothing in this plan runs against production without a separate,
explicit operator approval (RELEASE IDENTITY GATE → BACKUP → MIGRATION APPROVAL).

## 1. What was wrong

The previous release modeled "21 locales = 21 markets". That conflated three different things
(country, language, regional formatting) and produced:

- Belgium counted as two markets (`nl-BE`, `fr-BE`), Switzerland as two (`de-CH`, `fr-CH`)
- Australia (`en-AU`), Singapore (`en-SG`) and Luxembourg (`fr-LU`) counted as launch markets
- Canada missing its French locale (`fr-CA`)
- Poland, Romania, Czechia, Portugal and Greece missing entirely
- an internal `"UK"` market code alias diverging from ISO `GB`

## 2. The corrected model

Three explicitly separated models, canonical source `lib/markets/supportedMarkets.ts`:

| Model | Definition | Count |
|---|---|---|
| `MarketCountry` | one row per country; owns currency, tax strategy, timezone strategy, invoice locale, menu profile, address/phone/postal formats | **21** |
| `SupportedLanguage` | user-selectable UI language (`APP_LOCALES`) | **15** (nb, sv, da, fi, en, de, fr, es, it, nl, pl, ro, cs, pt, el) |
| `MarketLocale` | country + language + Intl formatting | **24** |

Canonical countries (19 European + US + CA):
`NO SE DK FI GB DE FR ES IT NL BE CH AT IE PL RO CZ PT GR US CA`

Multi-language markets (count ONCE each):

- **BE** → `nl-BE` + `fr-BE` (primary nl)
- **CH** → `de-CH` + `fr-CH` (primary de; Italian remains selectable as UI language for Swiss
  users — `it-CH` is not a market locale because no existing product requirement mandates it;
  revisit only with an explicit product decision)
- **CA** → `en-CA` + `fr-CA` (primary en)

Language choice never changes country, currency, tax, provider, price, tenant, contract,
cutoff or payment rules. Enforced by `tests/lib/markets/supportedMarkets.test.ts`,
`scripts/ci/verify-21-country-markets.mjs`, and the DB matrix test
(`tests/db/marketCutoffContext.test.ts` asserts one currency per country across locale rows).

## 3. Production data today

Production (`public.markets`) currently holds the 21 locale-based rows seeded by
`20260729120000_global_billing_engine_foundation.sql` + `20260813120000_markets_global_launch_readiness.sql`:
19 unique countries, all `is_active = true`, including `en-AU`, `en-SG`, `fr-LU`.
`markets` rows are referenced by `organization_billing_profiles.market_id`; no orders,
companies, providers or financial rows store a market locale directly.

## 4. Migration: `20260817120000_21_country_market_correction.sql` (additive, local-verified)

| Step | Action | Destructive? |
|---|---|---|
| 1 | INSERT 5 new markets: `PL/pl-PL`, `RO/ro-RO`, `CZ/cs-CZ`, `PT/pt-PT`, `GR/el-GR` (active, VAT seed, cutoff 08:00, invoice language = market language) | No (insert, `ON CONFLICT DO NOTHING`) |
| 2 | INSERT `CA/fr-CA` locale row (Canada stays ONE market — market identity is `country_code`) | No |
| 3 | UPDATE `is_active = false` for `AU`, `SG`, `LU` rows | No (flag only; rows retained and readable) |
| 4 | Widen `profiles.preferred_locale` CHECK to the 15 base languages | No (widening only) |
| 5 | Widen `menu_content_translations.locale` CHECK to the 15 base languages | No (widening only) |

Handling of legacy locale identities:

- **en-AU / en-SG / fr-LU** — rows retained, `is_active=false`. Any billing profile that were
  ever bound to these `market_id`s keeps resolving (reads unaffected). They are excluded from
  every launch surface via `is_active` and are absent from the code registries
  (`RETIRED_MARKET_LOCALES` / `RETIRED_LAUNCH_COUNTRIES` keep them readable in code).
- **nl-BE / fr-BE** — both rows keep `country_code='BE'`, `tax_country_code='BE'`, EUR: already
  ONE Belgian market at country level. Same for **de-CH / fr-CH** (CHF, CH). No row merging
  needed or performed — market identity is derived from `country_code`, so consolidation is a
  model-level correction, not a data mutation.
- **US / CA** — preserved unchanged; CA gains `fr-CA`.
- **UK→GB** — DB always stored `GB`; only the in-memory code alias `"UK"` was renamed.
  `providerCountryCodeToMarket` normalizes any legacy `"UK"` input to `GB`.

Verified guarantees: 0 DELETEs, 0 column drops, 0 type narrowings, 0 rows mutated outside
`is_active` on AU/SG/LU, all CHECK changes are widenings. Order/company/provider/financial
tables untouched.

### Production rollout order (when separately approved)

1. Backup + `scripts/ci/production-migration-preflight.mjs` (read-only)
2. `supabase db push` of `20260817120000` only
3. `scripts/ci/post-migration-verify.mjs` + the market matrix query
   (24 active locale rows, 21 distinct active countries, AU/SG/LU inactive)
4. Deploy app build from this branch (code and data flip together; the code registries
   fail closed for retired locales either way)

Rollback: the migration is idempotent and reversible — re-activate AU/SG/LU
(`is_active=true`) and deactivate the 6 new rows; CHECK widenings are harmless to leave.

## 5. Code surfaces corrected

| Surface | Change |
|---|---|
| `lib/markets/supportedMarkets.ts` | NEW canonical registry: 21 `MarketCountry` + 15 `SupportedLanguage` + 24 `MarketLocale` |
| `lib/i18n/localeRegistry.ts` | `APP_LOCALES` 10→15; `SUPPORTED_MARKET_LOCALES` 21→24 (drop AU/SG/LU, add fr-CA + PL/RO/CZ/PT/GR; `en-GB` market `UK`→`GB`) |
| `lib/i18n/marketLocaleRuntime.ts` | 15 base languages; explicit binding for all 24 market locales |
| `lib/i18n/messages.ts` | loaders for pl/ro/cs/pt/el catalogs |
| `messages/*.json` | 5 new complete catalogs (pl, ro, cs, pt, el) + provider locale labels ×15 in all bundles |
| `lib/email/i18n/emailCopy.ts` | invite + password reset copy for pl/ro/cs/pt/el |
| `lib/menu-profile/*` | `MARKET_CODES` +PL/RO/CZ/PT/GR, `UK`→`GB`; 5 new dormant profiles + warm-dish seeds + market defaults + runtime label maps; currencies +PLN/RON/CZK |
| `lib/provider-onboarding/phaseDLocales.ts` | AU/SG/LU targets removed; PL/RO/CZ/PT/GR targets added (SOURCE_ONLY) |
| `lib/providers/operationalSettingsShared.ts` | operational locale options ×15 |
| `lib/tiers/displayLabels.ts` | labels for fr-CA + 5 new locales (legacy fr-LU/en-AU/en-SG kept readable) |
| `lib/commercial/marketConfigs.ts` | inert config `UK`→`GB` |
| `lib/menu-generator/countryEconomyDefaults.ts` | UK/GB normalization + new market VAT/cost seeds |
| Gates | `scripts/ci/verify-21-country-markets.mjs` (NEW, fail-closed), `scripts/ci/verify-21-language-e2e.mjs` (corrected to 24/15), `tests/lib/markets/supportedMarkets.test.ts` (NEW) |

## 6. Review status (unchanged policy)

VAT seeds for PL (8%), RO (9%), CZ (12%), PT (13%), GR (13%) are catering defaults and carry
the same `LEGAL_REVIEW_PENDING` status as all non-NO markets (see `docs/GLOBAL-LAUNCH-MATRIX.md`).
The five new language catalogs are machine-drafted and marked `NATIVE_REVIEW_PENDING`, like
Dutch before them. Neither gate blocks code completeness; both block commercial launch per market.
