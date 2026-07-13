# GLOBAL LAUNCH MATRIX

Status per 2026-07-12 (21-COUNTRY MARKET CORRECTION). **Ett marked = ett land** —
21 kanoniske land (19 europeiske + US + CA), definert i `lib/markets/supportedMarkets.ts`.
Flerspråklige land (BE, CH, CA) har flere locale-rader i `markets`-tabellen men telles én gang.
Etter migrasjon `20260817120000` (lokalt verifisert, IKKE kjørt mot production): 24 aktive
locale-rader over 21 land; AU/SG/LU er fjernet fra launch-scope (`is_active=false`, beholdt lesbare).
Se `docs/21-COUNTRY-MARKET-CORRECTION-PLAN.md`.

**Umbraco og lunchportalen.no er ikke endret eller testet i dette implementeringsoppdraget.**

## PASS-nivåer (sannhetsregel)

| Nivå | Betyr | Bevis |
|------|-------|-------|
| **CODE PASS** | Kapabiliteten er bevist i kode + migrasjoner via automatiserte tester mot lokal Supabase (full migrasjonskjede) | vitest/DB-tester, navngitt per kolonne |
| **STAGING PASS** | I tillegg verifisert mot staging (`uigxsboqeruxflgzqztl`) med ekte brukere/data | Playwright E2E 104/104 + staging-smoke |
| **PRODUCTION VERIFIED** | Prod-deploy gjennomført, post-migration verify PASS, production-smoke PASS, **MVA kommersielt godkjent** og en ekte smoke-bestillingsflyt kjørt i markedet | `post-migration-verify.mjs` + `global-launch-smoke.mjs` + operatørsignatur |

**Ingen marked har PRODUCTION VERIFIED ennå** — production er ikke endret av dette oppdraget.
PRODUCTION VERIFIED krever operatørstegene i runbooken + kommersiell MVA-godkjenning per marked.

## Matrise

| Marked | Språk (UI/faktura) | Valuta | Tidssone | MVA mat¹ | Meny² | Bestilling/avbest.³ | Stripe⁴ | Billing⁵ | Faktura⁶ | E-post⁷ | E2E⁸ | Status |
| ------ | ------------------ | ------ | -------- | -------- | ---- | ------------------- | ------- | -------- | -------- | ------- | ---- | ------ |
| NO | nb | NOK | Europe/Oslo | 15.00 % | STAGING PASS | STAGING PASS | STAGING PASS⁹ | CODE PASS | CODE PASS | CODE PASS | STAGING PASS (104/104) | **STAGING PASS** |
| SE | sv | SEK | Europe/Stockholm | 12.00 % | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | plattform-E2E delt | **CODE PASS** |
| DK | da | DKK | Europe/Copenhagen | 25.00 % | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | plattform-E2E delt | **CODE PASS** |
| FI | fi | EUR | Europe/Helsinki | 14.00 % | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | plattform-E2E delt | **CODE PASS** |
| GB | en | GBP | Europe/London | 20.00 % | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | plattform-E2E delt | **CODE PASS** |
| DE | de | EUR | Europe/Berlin | 19.00 % | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | plattform-E2E delt | **CODE PASS** |
| FR | fr | EUR | Europe/Paris | 10.00 % | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | plattform-E2E delt | **CODE PASS** |
| ES | es | EUR | Europe/Madrid | 10.00 % | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | plattform-E2E delt | **CODE PASS** |
| IT | it | EUR | Europe/Rome | 10.00 % | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | plattform-E2E delt | **CODE PASS** |
| IE | en | EUR | Europe/Dublin | 13.50 % | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | plattform-E2E delt | **CODE PASS** |
| NL | nl | EUR | Europe/Amsterdam | 9.00 % | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | plattform-E2E delt | **CODE PASS** |
| BE (nl-BE + fr-BE) | nl, fr | EUR | Europe/Brussels | 12.00 % | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | plattform-E2E delt | **CODE PASS** |
| AT | de | EUR | Europe/Vienna | 10.00 % | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | plattform-E2E delt | **CODE PASS** |
| CH (de-CH + fr-CH) | de, fr | CHF | Europe/Zurich | 8.10 % | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | plattform-E2E delt | **CODE PASS** |
| PL | pl | PLN | Europe/Warsaw | 8.00 % | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | plattform-E2E delt | **CODE PASS** |
| RO | ro | RON | Europe/Bucharest | 9.00 % | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | plattform-E2E delt | **CODE PASS** |
| CZ | cs | CZK | Europe/Prague | 12.00 % | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | plattform-E2E delt | **CODE PASS** |
| PT | pt | EUR | Europe/Lisbon | 13.00 % | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | plattform-E2E delt | **CODE PASS** |
| GR | el | EUR | Europe/Athens | 13.00 % | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | plattform-E2E delt | **CODE PASS** |
| US | en | USD | provider_required¹² | 0.00 %¹¹ | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | plattform-E2E delt | **CODE PASS** |
| CA (en-CA + fr-CA) | en, fr | CAD | provider_required¹² | 5.00 % | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | CODE PASS | plattform-E2E delt | **CODE PASS** |

**Fjernet fra launch-scope (21-land-korreksjonen):** AU, SG, LU — `is_active=false`, rader beholdt lesbare, aldri launch-markeder.

**Sammendrag:** 21 land totalt. NO = STAGING PASS · 20 land = CODE PASS · 0 land = PRODUCTION VERIFIED (krever prod-deploy + MVA-godkjenning + ekte smoke-flyt, se «Vei til PRODUCTION VERIFIED»).

## Vei til PRODUCTION VERIFIED (per marked)

1. Runbook steg 0–12 gjennomført (preflight → `db push --include-all` → `post-migration-verify.mjs` PASS → deploy → `global-launch-smoke.mjs` PASS)
2. **MVA-sats kommersielt/juridisk godkjent** for markedet (seed-defaults i `markets.vat_rate_food` er IKKE godkjente satser)
3. Stripe konfigurert for markedets valuta (`markets.stripe_status = 'configured'`)
4. **Ekte smoke-bestillingsflyt** i markedet: meny → bestilling → avbestilling → produksjon → provisjonsposting, dokumentert med rid/ordre-id
5. Operatør oppdaterer denne matrisen med dato + bevis-referanse

## Bevisreferanser (kjørt 2026-07-11)

1. **MVA:** `markets.vat_rate_food` per marked (`20260813120000`) + heltallsmatte-test alle satser (`tests/lib/billing/multiCurrencyCommission.test.ts`). Seed-defaults — krever kommersiell godkjenning (kolonnekommentar i DB + krav 2 over).
2. **Meny:** Golden path 103/103 + Sanity-webhook-suite + `menu_content_translations` (RLS-testet) + SMART-3 overlay m/fail-closed fallback.
3. **Bestilling/avbestilling:** Marked-/lokasjonstidssone-cutoff ende-til-ende (`lp_company_cutoff_context` i `lp_order_set` + trigger, `20260814120000`); per-markeds bevis `tests/db/marketCutoffContext.test.ts` (9/9); NO-semantikk uendret (golden path grønn etter endring).
4. **Stripe:** Webhookkjede 13 tester (signatur/idempotens/replay) + staging-smoke (`global-launch-smoke.mjs --webhooks`): middleware-allowlist bekreftet; signing secrets er prod-operatørsteg (smoke flagger `WEBHOOK_SECRET_MISSING` inntil satt).
5. **Billing:** Bigint-motor 10 valutaer inkl. negative korreksjoner/avrunding; billing-DB verifisert ren + production-lik base + post-migration verify (13 tabeller/13 RPC-er/RLS/grants/search_path).
6. **Faktura:** Legacy NOK/Tripletex isolert til NO (`loadNoMarketCompanyIds`); globale markeder via commission-motor (`lp_billing_create_commission_invoice`, testet).
7. **E-post:** 15 språk (invitasjon + reset), mottakerspråk-kjede profil → bedrift → marked → nb (`lib/email/i18n/emailCopy.ts`).
8. **E2E:** 104/104 bestått (0 skippet, 0 feilet) mot production-build + staging med E2E-brukere (employee/company_admin/superadmin): auth, rollelanding, redirect-sikkerhet, core flows inkl. backoffice, mobile invariants (S1.1), shells. I tillegg: 21-lands markedsflyt-suite `tests/markets/countryMarketFlow.test.ts` (169/169, 0 skippet) — én full flyt per land (marked → språk → locale → meny → bestilling/avbestilling → produksjon → levering → økonomi → faktura → e-post).
9. **Stripe NO:** Plattform-Stripe konfigurert (env-nivå); staging-smoke bekrefter fail-closed-kjeden; prod signing secrets = operatørsteg.
10. **Språk (21-land-korreksjonen):** 15 komplette base-språk (nb, sv, da, fi, en, de, fr, es, it, nl, pl, ro, cs, pt, el); nl/pl/ro/cs/pt/el er maskinutkast med `NATIVE_REVIEW_PENDING`/`LEGAL_REVIEW_PENDING` (se `docs/21-LANGUAGE-E2E-MATRIX.md`). Ingen uventet fallback: alle 24 market-locales binder til eget base-språk.
11. **US:** Sales tax-regime — 0 % i MVA-kolonnen; salgsskatt håndteres per kunde før kommersiell aktivering.
12. **Tidssone US/CA:** `provider_required` — hver provider må sette eksplisitt tidssone før aktivering (pilotdefaults America/New_York / America/Toronto).
