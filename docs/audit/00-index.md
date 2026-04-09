# Repo-revisjon — inngangsport (`docs/audit/00-index.md`)

> **Omfang / historikk:** Denne revisjonen og øvrige filer under `docs/audit/` er et **øyeblikksbilde** av hovedapplikasjonen (Next.js-monolitten) og **skal ikke** leses som dokumentasjon av det isolerte Python-verktøyet under `cua/` (policy merge). For `cua/`, se `cua/README.md` og `cua/docs/`.

**Revisjonsdato (generert):** 2026-04-05  
**Repo-rot:** `c:\prosjekter\lunchportalen` (Windows)  
**Metode:** Rekursiv filtraversering med skjulte mapper; maskinlesbar manifest + menneskelesbar rapport. Ingen endring i produksjonskode som del av revisjonen.

## Hva som ble analysert

- Hele arbeidskopien rekursivt, inkludert skjulte filer/mapper (`.git`, `.cursor`, `.env*` som filnavn på disk, osv.).
- Klassifisering av **generert/vendor/cache/system** etter banenivå: ethvert segment `node_modules`, `.git`, `.next`, `dist`, `build`, `coverage`, `.turbo`, `.vercel`, `out`, `.cache` markerer hele under-treet som `generated_only` i manifestet (innhold ikke narrativt fil-for-fil i hovedrapporten).
- Lesing i fulltekst av arkitekturkritiske filer (middleware, auth, Supabase-helpers, `next.config`, `instrumentation`, utvalgte API-ruter) — detaljert i `04-full-audit-report.md` og `07-runtime-build-auth-db-analysis.md`.
- Verifikasjon: `npm run typecheck`, `npm run lint`, `npm run build`, samt målrettet `vitest` for `tests/auth` og `tests/middleware` — se `09-verification-results.md`.
- **Ingen** hemmelige verdier rapportert; kun **navn** på miljøvariabler der det er relevant. Filer som `.env` / `.env.local` er inventert med `analyzedLevel: redacted` / `metadata_only` uten innhold.

## Pekere til alle audit-filer

| Fil | Formål |
|-----|--------|
| [01-repo-tree-full.txt](./01-repo-tree-full.txt) | Én relativ path per linje, sortert (full treflate som liste). |
| [02-file-manifest.json](./02-file-manifest.json) | Maskinlesbar manifest: alle paths med type, størrelse, klassifisering, flagg. |
| [03-file-manifest.csv](./03-file-manifest.csv) | Samme som JSON, CSV for filtrering i regneark. |
| [04-full-audit-report.md](./04-full-audit-report.md) | Hovedrapport med seksjoner 1–19 (sammendrag → konklusjon). |
| [05-top-level-directories.md](./05-top-level-directories.md) | Vurdering av hver rot-mappe og rot-fil. |
| [06-file-by-file-review.md](./06-file-by-file-review.md) | Metode + peker til eksplisitte path-lister. |
| [parts/](./parts/) | Del-lister: `06a`–`06f` paths; `auth-related-paths.txt` (406 auth-flagged filer). |
| [07-runtime-build-auth-db-analysis.md](./07-runtime-build-auth-db-analysis.md) | Dybde: runtime, build, auth, middleware, Supabase, DB, env, importkjeder. |
| [08-risk-register.md](./08-risk-register.md) | Risikoer med alvorlighet og tiltak. |
| [09-verification-results.md](./09-verification-results.md) | Kommandoresultater (typecheck/lint/build/test). |
| [10-external-advisor-package.md](./10-external-advisor-package.md) | Leserekkefølge og hva som krever staging/remote. |
| [tools/generate-inventory.mjs](./tools/generate-inventory.mjs) | Reproduserbar generator for tree + JSON + CSV (ikke produksjonskode). |
| [tools/generate-file-review-parts.mjs](./tools/generate-file-review-parts.mjs) | Generator for `parts/06a`–`06f`. |

## Totale tellinger (manifest / kryssjekk)

| Mål | Verdi | Merknad |
|-----|-------|---------|
| Totale manifest-poster (filer + mapper + unknown) | **172 870** | = antall linjer i `01-repo-tree-full.txt` |
| Daværende mapper (`type: dir`) | **19 031** | |
| Daværende filer (`type: file`) | **153 839** | Inkl. generert/vendor |
| Poster utenfor `generated_only` | **7 281** | Primært kilde, docs, tester, supabase, scripts |
| Filer utenfor `generated_only` | **5 834** | |
| `app/api/**/route.ts` (ikke generert) | **568** | App Router API route handlers |
| SQL-filer `.sql` (ikke generert, hele repo i manifest) | **160** | Inkl. `.tmp*`, `docs/db/`, `scripts/sql/`, migrasjoner |
| Migrasjoner `supabase/migrations/*.sql` | **153** | Telt via manifest (matcher glob) |
| Tester `tests/**/*.test.ts` | **273** | Glob |
| Tester `tests/**/*.test.tsx` | **14** | Glob |
| Manifest-flagg `authRelated` (filer, ikke generert) | **406** | Liste: `parts/auth-related-paths.txt` |
| `middleware.ts` (rot, ikke generert) | **1** | Next.js edge middleware |

## Kryssjekk: tree ↔ manifest ↔ dekning

- **Tree vs manifest:** Antall linjer i `01-repo-tree-full.txt` = `summary.totalEntries` i `02-file-manifest.json` (**172 870** på tidspunkt for generering).
- **Alle paths representert:** Traversering startet fra repo-rot; poster som ikke kunne `lstat`es ville fått `type: unknown` med `notes` — ingen slike observert i siste kjøring.
- **Utelatte paths:** Ingen kjente utelatelser; se eksplisitt seksjon i `04-full-audit-report.md` §3.
- **Top-level:** Alle observerte `topLevelArea`-verdier er omtalt i `05-top-level-directories.md` eller klassifisert som generert/vendor.

## Hovedfunn (kort)

1. **Stack:** Next.js 15 App Router (`next` 15.5.10), React 19, Supabase (`@supabase/ssr` + `supabase-js`), TypeScript, Vitest, Playwright, Sanity — se `04` §1.
2. **Bygg/kvalitet:** `typecheck` og `build` OK; `lint` OK med **advarsler** (hooks/img) — ikke feil. Se `09`.
3. **Auth:** Kanonisk signal for beskyttede ruter i middleware er Supabase SSR `sb-*-auth-token*` etter `updateSession`, med eksplisitt dev-only `lp_local_dev_auth` som matcher `getAuthContext`-logikk — se `07` §8–10.
4. **Repo-hygiene:** Svært mange rot-filer (policy-/audit-markdown, logger, JSON-artefakter) og stor `docs/`-flate; aktiv utviklingsgren med mange endringer (`rescue-ai-restore`) — **merge-avgjørelse** bør baseres på CI `build:enterprise` + review, ikke kun standard `build`. Se `08` og `04` §16.
5. **Supabase:** Migrasjonsmappe disiplinert med **153** filer; canonical server/public patterns dokumentert i `07`.

**Full detalj:** [04-full-audit-report.md](./04-full-audit-report.md).
