# 21-COUNTRY MARKET · LANGUAGE E2E MATRIX

Branch: `fix/correct-21-country-market-model` (bygger på `fix/complete-21-language-e2e`,
fra release-SHA `ada0183b44d2814bfe0294f30952cdb59dbf895c`).
Production ikke endret. Umbraco/Azure/lunchportalen.no/Stripe ikke berørt.

> **Modellkorreksjon:** Den tidligere «21 locales = 21 markeder»-modellen er forkastet.
> Lunchportalen støtter eksakt **21 LAND** (19 europeiske + USA + Canada). Land, språk og
> locale er tre separate modeller — se `lib/markets/supportedMarkets.ts` og
> `docs/21-COUNTRY-MARKET-CORRECTION-PLAN.md`.

## De tre modellene

| Modell | Kilde | Antall |
|---|---|---|
| `MarketCountry` (land) | `SUPPORTED_MARKETS` | **21** |
| `SupportedLanguage` (base-språk) | `SUPPORTED_LANGUAGES` / `APP_LOCALES` | **15** |
| `MarketLocale` (land + språk + formatering) | `MARKET_LOCALES` / `SUPPORTED_MARKET_LOCALES` | **24** |

## Kanonisk landliste (21 — fastslått, ikke gjettet)

| # | Land | Locales | Primærspråk | Valuta | Tidssone-strategi |
|---|------|---------|-------------|--------|-------------------|
| 1 | NO Norge | nb-NO | nb | NOK | fixed (Europe/Oslo) |
| 2 | SE Sverige | sv-SE | sv | SEK | fixed (Europe/Stockholm) |
| 3 | DK Danmark | da-DK | da | DKK | fixed (Europe/Copenhagen) |
| 4 | FI Finland | fi-FI | fi | EUR | fixed (Europe/Helsinki) |
| 5 | GB Storbritannia | en-GB | en | GBP | fixed (Europe/London) |
| 6 | DE Tyskland | de-DE | de | EUR | fixed (Europe/Berlin) |
| 7 | FR Frankrike | fr-FR | fr | EUR | fixed (Europe/Paris) |
| 8 | ES Spania | es-ES | es | EUR | fixed (Europe/Madrid) |
| 9 | IT Italia | it-IT | it | EUR | fixed (Europe/Rome) |
| 10 | NL Nederland | nl-NL | nl | EUR | fixed (Europe/Amsterdam) |
| 11 | BE Belgia | nl-BE + fr-BE | nl | EUR | fixed (Europe/Brussels) |
| 12 | CH Sveits | de-CH + fr-CH | de | CHF | fixed (Europe/Zurich) |
| 13 | AT Østerrike | de-AT | de | EUR | fixed (Europe/Vienna) |
| 14 | IE Irland | en-IE | en | EUR | fixed (Europe/Dublin) |
| 15 | PL Polen | pl-PL | pl | PLN | fixed (Europe/Warsaw) |
| 16 | RO Romania | ro-RO | ro | RON | fixed (Europe/Bucharest) |
| 17 | CZ Tsjekkia | cs-CZ | cs | CZK | fixed (Europe/Prague) |
| 18 | PT Portugal | pt-PT | pt | EUR | fixed (Europe/Lisbon) |
| 19 | GR Hellas | el-GR | el | EUR | fixed (Europe/Athens) |
| 20 | US USA | en-US | en | USD | provider_required |
| 21 | CA Canada | en-CA + fr-CA | en | CAD | provider_required |

**Fjernet fra launch-scope (21-land-korreksjonen):** AU (en-AU), SG (en-SG), LU (fr-LU) —
beholdt lesbare i DB (`is_active=false`) og i kode (`RETIRED_MARKET_LOCALES`), aldri aktive.

**Flerspråklige markeder telles ÉN gang:** Belgia (nl+fr), Sveits (de+fr; italiensk er
valgbart UI-språk for sveitsiske brukere, `it-CH` er ikke market-locale), Canada (en+fr).

Språkvalg endrer aldri land, valuta, MVA/tax, provider, pris, tenant, kontrakt, cutoff
eller betalingsregler.

## 15 base-språk (alle med komplett runtime-katalog)

nb · sv · da · fi · en · de · fr · es · it · nl · **pl · ro · cs · pt · el** (5 nye)

Regionale varianter (en-GB/en-US/en-CA/en-IE, de-DE/de-AT/de-CH, fr-FR/fr-BE/fr-CH/fr-CA,
nl-NL/nl-BE) deler base-språktekst men har korrekt egen Intl-formatering (dato, klokkeslett,
tall, valuta, prosent) via market-locale.

## Gater (fail-closed)

| Gate | Fil | Status |
|---|---|---|
| 21-land markedsgate | `scripts/ci/verify-21-country-markets.mjs` | ✅ PASS (21/21 land, 0 forbudte, BE/CH/CA=1 rad) |
| Market-locale språkgate | `scripts/ci/verify-21-language-e2e.mjs` | ✅ PASS (24/24 locales, 15/15 språk, 0 missing/raw/mojibake/fallback) |
| Registry-tester | `tests/lib/markets/supportedMarkets.test.ts` | ✅ |
| DB-matrise | `tests/db/marketCutoffContext.test.ts` | ✅ (24 aktive locale-rader, 21 unike land, AU/SG/LU inaktive, én valuta per land) |

## Review-status per base-språk (ærlig)

| Base-språk | TECHNICALLY_COMPLETE | NATIVE_REVIEW | LEGAL/BILLING_REVIEW |
|-----------|----------------------|---------------|----------------------|
| nb | ✅ | ✅ (kilde/morsmål) | ✅ (NO produksjon) |
| da, de, en, es, fr, fi, it, sv | ✅ | PENDING | PENDING |
| nl | ✅ | NATIVE_REVIEW_PENDING | LEGAL_REVIEW_PENDING |
| **pl, ro, cs, pt, el (nye)** | ✅ | **NATIVE_REVIEW_PENDING** | **LEGAL_REVIEW_PENDING** |

Teknisk gate = PASS for alle 15 språk og 24 market-locales. Maskinutkast-språkene er reelle
oversettelser, men ikke morsmåls-/juridisk sertifisert — det er en separat menneskelig gate
før kommersiell aktivering per marked (samme policy som nederlandsk).
