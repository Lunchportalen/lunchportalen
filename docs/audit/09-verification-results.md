# Verifikasjonsresultater (`docs/audit/09-verification-results.md`)

**Dato:** 2026-04-05  
**Miljø:** Lokal Windows-arbeidskopi. Verdier fra eventuelle `.env`-filer er **ikke** gjengitt her.

## Kjørte kommandoer

| Kommando | Exit | Resultat |
|----------|------|----------|
| `npm run typecheck` | 0 | **PASS** — `tsc --noEmit` fullførte uten feil. |
| `npm run lint` | 0 | **PASS med advarsler** — `next lint`; mange `react-hooks/exhaustive-deps` og `@next/next/no-img-element` i bl.a. backoffice content og superadmin-klienter. Ingen ESLint *error* observert i output. |
| `npm run build` | 0 | **PASS** — `next build` fullførte (inkl. `scripts/verify-control-coverage.mjs` som pre-step i build-script). Middleware-bundle rapportert (~126 kB). |
| `npx vitest run tests/middleware tests/auth --config vitest.config.ts` | 0 | **PASS** — 18 testfiler, 54 tester. |

## Ikke kjørt (og hvorfor)

| Kommando / aktivitet | Begrunnelse |
|---------------------|-------------|
| `npm run build:enterprise` | Tung kjede (flere script + RC_MODE-guards + SEO-scripts). Standard `build` bekrefter kompilering; enterprise-bygg bør kjøres i CI eller ved eksplisitt release-sjekk. |
| `npm run test:run` (full suite) | Tid/omfang; målrettet auth+middleware er kjørt. Full suite anbefales før merge. |
| `npm run e2e` / Playwright | Krever installerte browsere og ofte staging-data; ikke kjørt i denne revisjonen. |
| `sanity:live` | Ikke kjørt (ekstern Sanity-avhengighet). |
| Remote database / `supabase db` | Ikke kontaktet (forbudt i oppdraget). |

## Observasjoner (uten hemmeligheter)

- Vitest/dotenv logget at miljø lastes fra `.env.local` under test — forventet lokalt; **ingen** nøkkelverdier gjengitt i denne rapporten.
- `next lint` melder at `next lint` er deprecated mot Next.js 16 — fremtidig migrering til ESLint CLI (informasjonsmessig, ikke feil).

## Auth- / middleware-relaterte tester (kjørt)

- `tests/middleware/middlewareImportEdgeSafe.test.ts` — importkjede edge-sikkerhet.
- `tests/middleware/middlewareRedirectSafety.test.ts` — redirect-sikkerhet.
- `tests/auth/*` — post-login, local dev bypass, login API, employee surfaces, m.m. (se test-output i CI-logg lokalt).
