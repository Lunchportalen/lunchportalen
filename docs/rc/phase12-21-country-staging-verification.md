# FASE 12 — 21-landsmodell anvendt og verifisert på staging

**Dato:** 2026-07-14 · **Miljø:** staging `uigxsboqeruxflgzqztl` (production `hkpoky` IKKE berørt — hardt avvist i verktøyet)
**Verktøy:** `scripts/verify/phase12-21-country-staging.mjs` (repeterbar, fail-closed)

## Resultat: PASS (alle akseptansekrav)

| Krav | Bevis |
|---|---|
| 21 unike land | `NO SE DK FI GB DE FR ES IT NL BE CH AT IE PL RO CZ PT GR US CA` — eksakt kanonisk sett aktivt |
| 24 supported locales | Eksakt kanonisk sett aktivt (nb-NO … fr-CA) |
| AU/SG/LU inaktive | `is_active=false`, radene lesbare: `en-AU (AUD)`, `en-SG (SGD)`, `fr-LU (EUR)` — ingen sletting |
| BE ett marked | Locales `nl-BE + fr-BE`, samme country_code |
| CH ett marked | Locales `de-CH + fr-CH` |
| CA ett marked | Locales `en-CA + fr-CA` |
| Alle constraints gyldige | 0 `NOT VALID`-constraints i public |
| Ingen orphan-rader | 12 kjernerelasjoner sjekket (orders/companies/providers/agreements/fakturaer/ledger/profiler): 0 |
| Ingen datatap | Eksakt radtelling for 19 domenetabeller identisk før/etter rehearsal |
| Rollback bevist | Transaksjonell rehearsal: pre-20260817-modellen (19 land / 21 locales) reprodusert og lest, deretter ROLLBACK — nåværende modell (21/24) intakt uten sideeffekter |

## Kjørte steg

1. **Backup** — logisk dump av markedsdomenet (`markets`=27, `market_approvals`=21, `market_approval_events`) +
   radtelling-baseline for alle domenetabeller → `.backups/phase12-market-domain-<stamp>.json` (gitignored, lokal).
   Plattformnivå: Supabase automated backups/PITR gjelder i tillegg.
2. **Migrasjoner** — 81/81 lokale migrasjoner applied på staging, inkl. `20260815120000` (nl-widening),
   `20260816120000` (menu translations nl), `20260817120000` (21-landskorreksjonen) og alle godkjente
   Fase 8–11-migrasjoner (t.o.m. `20260826120000`).
3. **Post-migration verification** — `scripts/ci/post-migration-verify.mjs`: full PASS
   (billing-tabeller/RPC-er, RLS, anon-grants, auth-hook, cutoff-wiring, 21/21 markeds-skattekonfig,
   US/CA-eksplisitt, godkjenningsregister, SECDEF-hygiene).
4. **Markedsmatrise** — 21 land / 24 locales / AU+SG+LU inaktive / BE+CH+CA multi-locale (se tabell).
5. **RLS** — `check-rls-drift`: 293/293 policies identisk med golden snapshot; RLS-testsuitene
   (provider-rls, menu-content-translations-rls, mapping-drafts-rls, database-integrity) PASS.
6. **Språk** — `verify-21-country-markets` PASS, `verify-21-language-e2e` PASS (24/24 bundles),
   `verify-language-content` PASS (15/15 kataloger rene).
7. **Faktura/skatt** — integrasjonssuitene for provider→company-faktura, provisjonsoppgjør,
   global skatteberedskap og superadmin-oversettelse + kontraktsuitene (billing/tax): 133/133 PASS.
8. **Rollback-rehearsal** — se tabell; ingen datasletting i noen retning.

## Repetisjon

```bash
node scripts/verify/phase12-21-country-staging.mjs   # hele fasen på nytt (staging-only)
```

Production-cutover gjøres i egen fase med samme verktøy og eget godkjenningsløp — aldri direkte.
