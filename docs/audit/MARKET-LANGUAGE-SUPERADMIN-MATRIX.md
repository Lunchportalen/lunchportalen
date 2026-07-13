# MARKET / LANGUAGE / SUPERADMIN MATRIX — 21 kanoniske land

Dato: 2026-07-13 · Read-only audit

## KRITISK SKILLE: Production vs lokal HEAD

| Fakta | Production (`ada0183b`) | Lokal HEAD (`a9c3e0fd`, UPUSHET) |
|---|---|---|
| Runtime-språkkataloger | **9** (nb, sv, da, de, en, es, fi, fr, it) | **15** (+ nl, pl, ro, cs, pt, el) |
| Markedsmodell | 21 locale-rader presentert som 21 markeder (AU/SG/LU aktive; PL/RO/CZ/PT/GR mangler; BE og CH dobbelttalt) | 21 land / 15 språk / 24 markedslocales (`lib/markets/supportedMarkets.ts`) |
| DB `markets`-tabell (prod) | 21 rader, GAMMEL modell (verifisert read-only): AU/SG/LU is_active=true, ingen PL/RO/CZ/PT/GR, BE×2, CH×2, GB lagret som «GB» men UK-alias i kode | Korreksjonsmigrasjon `20260817120000` finnes lokalt, **IKKE kjørt mot prod** |
| profiles.preferred_locale CHECK (prod) | t.o.m. nl (10 verdier, migrasjon 20260815 IKKE kjørt — kun t.o.m. 20260814 i prod → 9 verdier) | 15 verdier |
| Faktisk brukte locales i prod-data | Kun `nb` (alle 50 profiler) | — |

**Konklusjon:** «21 land»-modellen er CODE_COMPLETE_NOT_LIVE. Production kjører en 9-språks / flawed-markets-modell.

## Per land (basert på lokal kanonisk modell + prod-DB-avvik)

Kolonner: Base languages = UI-språk i landet; Locales = markedslocales; UI = runtime-katalog finnes; E-post = emailCopy-dekning; Faktura = invoiceLocale definert; Superadmin norsk = systemtekst norsk for objekter fra landet; Native/Legal = review-status (docs/21-LANGUAGE-E2E-MATRIX.md).

| # | Land | Base lang | Locales | UI-katalog (prod / lokal) | E-post (prod / lokal) | Faktura-locale | Tax-tekst | Superadmin norsk | Native review | Legal review | Prod markets-rad |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | NO | nb (+en) | nb-NO | ✅ / ✅ | ✅ / ✅ | nb-NO | vat 15 % | ✅ (native) | ✅ | ✅ | ✅ (stripe_status=configured — motsagt av manglende env) |
| 2 | SE | sv (+en) | sv-SE | ✅ / ✅ | ✅ / ✅ | sv-SE | vat 12 % | ✅ systemtekst, rå fritekst | PENDING | PENDING | ✅ |
| 3 | DK | da (+en) | da-DK | ✅ / ✅ | ✅ / ✅ | da-DK | vat 25 % | do. | PENDING | PENDING | ✅ |
| 4 | FI | fi (+sv,en) | fi-FI | ✅ / ✅ | ✅ / ✅ | fi-FI | vat 14 % | do. | PENDING | PENDING | ✅ |
| 5 | GB | en | en-GB | ✅ / ✅ | ✅ / ✅ | en-GB | vat 20 % | do. | PENDING | PENDING | ✅ (som GB) |
| 6 | DE | de (+en) | de-DE | ✅ / ✅ | ✅ / ✅ | de-DE | vat 19 % | do. | PENDING | PENDING | ✅ |
| 7 | FR | fr (+en) | fr-FR | ✅ / ✅ | ✅ / ✅ | fr-FR | vat 10 % | do. | PENDING | PENDING | ✅ |
| 8 | ES | es (+en) | es-ES | ✅ / ✅ | ✅ / ✅ | es-ES | vat 10 % | do. | PENDING | PENDING | ✅ |
| 9 | IT | it (+en) | it-IT | ✅ / ✅ | ✅ / ✅ | it-IT | vat 10 % | do. | PENDING | PENDING | ✅ |
| 10 | NL | nl (+en) | nl-NL | ❌ / ✅ | ❌ / ✅ | nl-NL | vat 9 % | do. | PENDING | PENDING | ✅ |
| 11 | BE | nl, fr (+en) | nl-BE, fr-BE | ❌(nl) ✅(fr) / ✅ | do. | nl-BE | vat 12 % | do. | PENDING | PENDING | ⚠️ 2 rader (dobbelttalt) |
| 12 | CH | de, fr (+it,en) | de-CH, fr-CH | ✅ / ✅ | ✅ / ✅ | de-CH | vat 8,1 % | do. | PENDING | PENDING | ⚠️ 2 rader (dobbelttalt) |
| 13 | AT | de (+en) | de-AT | ✅ / ✅ | ✅ / ✅ | de-AT | vat 10 % | do. | PENDING | PENDING | ✅ |
| 14 | IE | en | en-IE | ✅ / ✅ | ✅ / ✅ | en-IE | vat 13,5 % | do. | PENDING | PENDING | ✅ |
| 15 | PL | pl (+en) | pl-PL | ❌ / ✅ | ❌ / ✅ | pl-PL | vat | do. | PENDING | PENDING | ❌ MANGLER i prod |
| 16 | RO | ro (+en) | ro-RO | ❌ / ✅ | ❌ / ✅ | ro-RO | vat | do. | PENDING | PENDING | ❌ MANGLER i prod |
| 17 | CZ | cs (+en) | cs-CZ | ❌ / ✅ | ❌ / ✅ | cs-CZ | vat | do. | PENDING | PENDING | ❌ MANGLER i prod |
| 18 | PT | pt (+en) | pt-PT | ❌ / ✅ | ❌ / ✅ | pt-PT | vat | do. | PENDING | PENDING | ❌ MANGLER i prod |
| 19 | GR | el (+en) | el-GR | ❌ / ✅ | ❌ / ✅ | el-GR | vat | do. | PENDING | PENDING | ❌ MANGLER i prod |
| 20 | US | en | en-US | ✅ / ✅ | ✅ / ✅ | en-US | sales_tax (0 % seed) | do. | PENDING | PENDING | ✅ |
| 21 | CA | en, fr | en-CA, fr-CA | ✅(en) / ✅ (fr-CA kun lokal) | ✅ / ✅ | en-CA | sales_tax (5 % seed) | do. | PENDING | PENDING | ✅ (kun en-CA) |

Ikke-launch-markeder i prod-DB som skulle vært fjernet: **AU, SG, LU (alle is_active=true i prod)** — retirert kun i upushet lokal kode.

## KRITISK NYTT FUNN — språklig innhold vs nøkkel-komplett (fra fullesning av alle 15 kataloger)

Alle 15 lokale kataloger er **nøkkel-komplette** (verify-21-language-e2e PASS), men **språklig kontaminert**:
- `provider.menu.runtimeMappingProposal.draftSave.saveButton` = «Lagre vurdering som utkast» (norsk) i **10 av 14** ikke-nb-kataloger (en, da, de, es, fi, fr, it, sv m.fl.).
- Hele engelskspråklige blokker (`workspaceWarmDishGeneration`, `draftSave`) i de/es/fi/fr/sv.
- Skandinavisk krysslekk: svensk («Leveransadress», «Avtalsperiod») i da.json og sv.json-avtaleetiketter; engelsk («Org.nr not registered») og norsk/dansk hybrid («Mangler provider.») i sv.json.
- **Porten `verify-21-language-e2e.mjs` fanger IKKE dette** — den sjekker nøkkeleksistens, interpolasjon, mojibake og tomverdier, ikke at strenginnhold er på målspråket. «Complete 21 locale end-to-end support» er derfor en strukturell, ikke språklig, sannhet selv lokalt.

## Talloppsummering (svar på kanoniske spørsmål)

| Spørsmål | Production | Lokal HEAD |
|---|---|---|
| Antall land | Udefinert (21 locale-rader ≠ land; reelt 18 unike land inkl. AU/SG/LU) | **21** |
| Antall grunnspråk | 9 | **15** |
| Antall runtime-språkkataloger | 9 | **15** |
| Antall regionale locales | — (ingen locale-modell) | **24** |
| Komplette e-postspråk | 9 | **15** (nøkkel-komplette; språklig QA utestående) |
| Komplette fakturaspråk | `invoice_language` per markets-rad (app-locale) | **21** invoiceLocale (BCP47) — men ingen faktisk flerspråklig fakturagenerering er wired |
| Native-reviewed språk | **1 (nb)** | 1 (nb) |
| Legal-reviewed språk | **1 (nb)** | 1 (nb) |

## Superadmin-kravet (eksplisitt undersøkt)

Når en polsk/gresk/fransk/tysk/nederlandsk/amerikansk registrering kommer inn:

| Spørsmål | Svar | Evidens |
|---|---|---|
| Ser superadmin norsk systemtekst? | JA | Hardkodet norsk i alle superadmin-flater (0 next-intl-treff i `app/superadmin`) |
| Ser superadmin originalinnhold? | JA, rått | `registrations/page.tsx` rendrer company_name/adresse som lagret |
| Norsk maskinoversettelse? | NEI | `lib/i18n/translate.ts` er stub, ubrukt i superadmin |
| Lagret oversettelse? | NEI | `menu_content_translations` gjelder kun menyinnhold (employee-runtime), ikke superadmin |
| Fallback? | Rå tekst / norske enum-labels | statusmapping til norsk finnes |
| Kan superadmin se originalspråk? | NEI | Ingen språkindikator lagres/vises |
| Kan superadmin godkjenne uten å forstå originalspråket? | Teknisk ja (knappene virker), innholdsmessig blindt | ingen oversettelsesstøtte |
| Audit av oversettelse? | N/A | ingen oversettelse finnes |

**Status norsk Superadmin-oversettelse av utenlandsk innhold: MISSING.**
