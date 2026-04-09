# Rebaseline — kommandoer og resultater

**Dato:** 2026-03-27  
**Miljø:** Windows, Node med `NODE_OPTIONS=--max-old-space-size=8192` for enterprise-build (se nedenfor).

Alle kommandoer kjørt fra repo-root: `c:\prosjekter\lunchportalen`.

| Kommando | Exit | Merknad |
|----------|------|---------|
| `npm run typecheck` | **0** | `tsc --noEmit` — fullført uten feil (~53 s). |
| `npm run lint` | **0** | `next lint` — **warnings** (ikke errors), bl.a. `react-hooks/exhaustive-deps` i `ContentWorkspace.tsx` og `@next/next/no-img-element` flere steder. |
| `npm run test:run` | **0** | Vitest: **193** testfiler, **1133** tester, varighet ~75 s. |
| `npm run build:enterprise` | **0** | Med `$env:NODE_OPTIONS="--max-old-space-size=8192"`. Total tid ~747 s (~12,5 min). Inkluderer `agents:check`, `ci:platform-guards`, `audit:api`, `audit:repo`, kontroller, `next build`, `seo-proof.mjs`, `seo-audit.mjs`, `seo-content-lint.mjs`. |
| `npm run sanity:live` | **0** | **Soft gate:** `localhost:3000` ikke tilgjengelig — script logget WARNING og returnerte 0 (forventet når app ikke kjører). |
| `npm run build` (kun `next build` + verify-control-coverage) | **Ikke kjørt** | `build:enterprise` inkluderer `next build` etter de samme forhåndsgatene; separat `npm run build` ble ikke duplisert i denne rebaseline-runden. |

## Viktige logger (utdrag)

### `build:enterprise` (api-contract-enforcer)

- `api-contract-enforcer: **557** route.ts file(s) OK.`
- `ai-governance-check: 63 file(s) OK.`
- `next build`: Compiled successfully; deretter ESLint/typecheck-fase med samme warnings som `npm run lint`.
- Avslutning: `SEO-PROOF OK`, `SEO-AUDIT OK`, `SEO-CONTENT-LINT OK`, `EXIT:0`.

### `test:run`

- `Test Files  193 passed (193)`
- `Tests  1133 passed (1133)`

## Hva som feilet

- **Ingenting** av de obligatoriske kommandoene over feilet (exit 0).

## Heap / minne

- **`build:enterprise`** ble kjørt med **`NODE_OPTIONS=--max-old-space-size=8192`**. Fullførte OK.
- **`npm run build` / `build:enterprise` uten hevet heap** er **ikke** re-verifisert i denne kjøringen — tidligere audit rapporterte OOM (exit 134) på standard minne; **R1 forblir miljøavhengig risiko** til motbevist med ren kjøring.

## Forskjell: git-sporet vs filsystem (kritisk for tolkning)

På denne arbeidsmaskinen:

| Måling | `git ls-files` (sporet) | Filsystem (glob / `Get-ChildItem`) |
|--------|-------------------------|-------------------------------------|
| `app/api/**/route.ts` | **314** | **557** |
| `lib/ai/**/*.ts` | **295** | **698** |

Det betyr at **API- og AI-flaten på disk overstiger det som er sporet i git** i denne kopien — `audit:api` / `api-contract-enforcer` skanner **alle** matchende `route.ts` på disk. **Konklusjon for release:** bruk **git** som sannhet for «hva som merges»; re-run tall på ren branch etter `git status` er ryddig.
