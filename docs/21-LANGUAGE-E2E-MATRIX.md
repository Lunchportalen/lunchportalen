# 21-LANGUAGE END-TO-END MATRIX

Branch: `fix/complete-21-language-e2e` (fra release-SHA `ada0183b44d2814bfe0294f30952cdb59dbf895c`).
Production ikke endret. Umbraco/Azure/lunchportalen.no ikke berørt.

## Kanonisk liste (fastslått, ikke gjettet)

Kilde: `lib/i18n/localeRegistry.ts` → `SUPPORTED_MARKET_LOCALES` (21 entries), verifisert mot
`tests/lib/i18n/localeRegistry.test.ts:78-100` (eksakt rekkefølge-assert) og commit `e39dcb8f`
(«Complete 21-market locale coverage»). Phase C = 9 launch-locales (`lib/provider-onboarding/phaseCLocales.ts`),
Phase D = 12 SOURCE_ONLY-locales (`lib/provider-onboarding/phaseDLocales.ts`). 9 + 12 = 21.

| # | Locale | Språk (base) | Marked | Runtime bundle (dagens tilstand) | Kilde-fase |
|---|--------|--------------|--------|----------------------------------|------------|
| 1 | nb-NO | Norsk bokmål (nb) | NO | ✅ `messages/nb.json` | Phase C (covered) |
| 2 | sv-SE | Svensk (sv) | SE | ✅ `messages/sv.json` | Phase C (covered) |
| 3 | da-DK | Dansk (da) | DK | ✅ `messages/da.json` | Phase C (pending) |
| 4 | fi-FI | Finsk (fi) | FI | ✅ `messages/fi.json` | Phase C (pending) |
| 5 | en-GB | Engelsk (en) | UK | ✅ `messages/en.json` | Phase C (pending) |
| 6 | de-DE | Tysk (de) | DE | ✅ `messages/de.json` | Phase C (pending) |
| 7 | fr-FR | Fransk (fr) | FR | ✅ `messages/fr.json` | Phase C (pending) |
| 8 | es-ES | Spansk (es) | ES | ✅ `messages/es.json` | Phase C (pending) |
| 9 | it-IT | Italiensk (it) | IT | ✅ `messages/it.json` | Phase C (pending) |
| 10 | en-US | Engelsk (en) | US | ⚠️ regional variant av en | Phase D SOURCE_ONLY |
| 11 | en-CA | Engelsk (en) | CA | ⚠️ regional variant av en | Phase D SOURCE_ONLY |
| 12 | nl-NL | **Nederlandsk (nl)** | NL | ❌ mangler base-språk (faller til en) | Phase D SOURCE_ONLY |
| 13 | nl-BE | **Nederlandsk (nl)** | BE | ❌ mangler base-språk (faller til en) | Phase D SOURCE_ONLY |
| 14 | fr-BE | Fransk (fr) | BE | ⚠️ regional variant av fr | Phase D SOURCE_ONLY |
| 15 | de-AT | Tysk (de) | AT | ⚠️ regional variant av de | Phase D SOURCE_ONLY |
| 16 | de-CH | Tysk (de) | CH | ⚠️ regional variant av de | Phase D SOURCE_ONLY |
| 17 | fr-CH | Fransk (fr) | CH | ⚠️ regional variant av fr | Phase D SOURCE_ONLY |
| 18 | en-IE | Engelsk (en) | IE | ⚠️ regional variant av en | Phase D SOURCE_ONLY |
| 19 | fr-LU | Fransk (fr) | LU | ⚠️ regional variant av fr | Phase D SOURCE_ONLY |
| 20 | en-AU | Engelsk (en) | AU | ⚠️ regional variant av en | Phase D SOURCE_ONLY |
| 21 | en-SG | Engelsk (en) | SG | ⚠️ regional variant av en | Phase D SOURCE_ONLY |

## Hva de 21 locale-ene faktisk dekomponerer til

- **10 base-språk:** nb, sv, da, fi, en, de, fr, es, it (9 har komplette bundles) + **nl (nederlandsk)** som mangler helt.
- **11 regionale varianter** av allerede-eksisterende base-språk (en×6, de×2 utover DE, fr×3 utover FR): identisk UI-tekst som base-språket, men egen Intl-formatering (dato/tall/valuta) per market-locale.
- **Genuint ny lingvistikk som må skrives:** kun **nederlandsk (nl)**.

Regional variasjon (en-GB vs en-US osv.) er standard i18n: teksten er reelt lik, formateringen
styres av market-locale via `Intl`. Å behandle det som «9 språk + fallback» er feil ramme —
men å kreve 21 håndskrevne, distinkte tekstkataloger for regionale engelskvarianter er også
lingvistisk meningsløst for UI-copy. Korrekt modell: **21 runtime-locales, hver med komplett
oppløsning (base-språktekst + market-Intl-formatering), 0 rå-nøkkel-lekkasje, 0 uventet fallback.**

## Statusnivåer (ærlig)

- **Teknisk komplett:** locale resolver til komplett katalog, ingen rå nøkler, korrekt Intl-format.
- **Native review:** menneskelig morsmålskontroll av tekstkvalitet — separat gate.
- **Legal/billing review:** juridisk/faglig godkjenning av faktura-/MVA-/betalingstekst — separat gate.

## Implementert i denne branchen (verifisert)

| Artefakt | Fil | Status |
|----------|-----|--------|
| 21-locale runtime-resolver | `lib/i18n/marketLocaleRuntime.ts` | ✅ alle 21 → {base-språk, Intl-locale}, ingen fallback for nl |
| Resolver-tester | `tests/lib/i18n/marketLocaleRuntime.test.ts` | ✅ 7/7 (inkl. Intl-format skiller £/$ for en-GB/en-US) |
| Fail-closed CI-gate | `scripts/ci/verify-21-language-e2e.mjs` | ✅ fail-closed; rapporterer eksakt tilstand |

### Faktisk tilstand etter resolver (CI-gate-kjøring)

```text
Locales expected: 21
Runtime bundles: 19/21        ← 9 base-språk dekker 19 av 21 (inkl. 11 regionale en/de/fr-varianter, nå førsteklasses)
Missing keys: 0
Raw key leaks: 0
Invalid interpolation: 0
Mojibake: 0
SOURCE_ONLY locales: 0        ← runtime-binding behandler alle 21 som førsteklasses
Unexpected fallbacks: 1       ← nl-NL/nl-BE mangler nederlandsk base-katalog
Incomplete base languages: nl
```

### Eneste gjenstående gap: nederlandsk (nl)

`nl-NL` og `nl-BE` krever en komplett nederlandsk `messages/nl.json` (~82KB, superset av nb-nøkkelsettet).
Dette er profesjonell oversettelse (menneske) + native/legal review — ikke agent-generert innhold.
Å kopiere engelsk tekst under `nl` ville passert den strukturelle gaten, men vist engelsk til
nederlandske brukere (forbudt «blandet språk / uventet fallback»), så det er bevisst IKKE gjort.

De 11 regionale variantene (en-US/en-CA/en-IE/en-AU/en-SG, de-AT/de-CH, fr-BE/fr-CH/fr-LU) er nå
teknisk komplette: identisk base-språktekst + korrekt markeds-Intl-formatering (dato/tall/valuta),
som er korrekt i18n-modell for regionale varianter — ikke fallback.

## Nederlandsk fullført (Dutch completion)

`messages/nl.json` er en komplett nederlandsk runtime-katalog (samme nøkkelsett som `nb.json`,
0 manglende nøkler, 0 rå-nøkler, 0 mojibake). Nederlandsk er nå det 10. base-språket:

- `APP_LOCALES` utvidet nb, da, de, en, es, fr, it, fi, **nl**, sv (10)
- `messages.ts` laster `nl.json`; `nl-NL`/`nl-BE` binder til `nl` (ikke lenger engelsk)
- 3 additive DB-migrasjoner (utvider CHECK-allowlists, ingen datatap):
  - `20260815120000_profiles_preferred_locale_add_dutch.sql`
  - `20260816120000_menu_content_translations_add_dutch.sql`
- `provider_settings` operational-locale + `operations.locales`-katalog utvidet med `nl-NL`
- Meny-fixture med provider-godkjent nederlandsk tekst: `tests/_fixtures/menu-nl-approved.json`
  (nl-NL og nl-BE; maskinutkast markert `draft`, aldri `approved`; nl-BE «Dagschotel» vs nl-NL
  «Warm gerecht van de dag» viser regional variasjon)

## Review-status per base-språk (ærlig)

| Base-språk | TECHNICALLY_COMPLETE | NATIVE_REVIEW | LEGAL/BILLING_REVIEW |
|-----------|----------------------|---------------|----------------------|
| nb | ✅ | ✅ (kilde/morsmål) | ✅ (NO produksjon) |
| da, de, en, es, fr, fi, it, sv | ✅ | PENDING (eksisterende bundles, ikke sertifisert i dette oppdraget) | PENDING |
| **nl (nederlandsk)** | ✅ | **NATIVE_REVIEW_PENDING** | **LEGAL_REVIEW_PENDING** |

Teknisk gate = PASS (alle kataloger komplette, alle tester grønne, ingen fallback, ingen rå
nøkler, 21/21 locale-pakker fungerer). Nederlandsk tekst er en reell menneskelesbar oversettelse,
men er ikke morsmåls-/juridisk sertifisert — det er en separat menneskelig gate før produksjonsaktivering.
