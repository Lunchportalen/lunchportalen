# Phase 1B — Verifikasjon

Dato: 2026-03-28 (lokal kjøring).

## `npm run typecheck`

**PASS** (`tsc --noEmit`).

## Vitest (relevant utvalg)

| Fil | Resultat |
|-----|----------|
| `tests/auth/employeeAppSurface.test.ts` | PASS |
| `tests/auth/postLoginRedirectSafety.test.ts` | PASS |
| `tests/lib/weekAvailability.test.ts` | PASS |

Kjøring:

`npm run test:run -- tests/auth/employeeAppSurface.test.ts tests/auth/postLoginRedirectSafety.test.ts`

`npm run test:run -- tests/lib/weekAvailability.test.ts`

## `npm run build:enterprise`

**FAIL (lokal Windows)** — ikke kildekode-feil, men **Node heap out of memory** under `next build`:

```
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
Next.js build worker exited with code: 134
```

**Anbefaling før Fase 2 / CI:** sett `NODE_OPTIONS=--max-old-space-size=8192` (eller høyere) for `next build` på store worktrees.

## `npm run build` (standard script, med økt heap)

Med `NODE_OPTIONS=--max-old-space-size=8192`:

- **Compile:** `✓ Compiled successfully in 10.2min`
- **Lint:** mange eksisterende ESLint *warnings* (react-hooks/exhaustive-deps, no-img-element, …) — ingen nye blokkerende feil observert i loggutdrag.

Full ferdigstillelse av `npm run build` (collecting page data / static generation) er **ikke** bekreftet i denne loggen — kjør lokalt med tilstrekkelig minne for endelig exit code.

## Minimumstester (status)

| Krav | Status |
|------|--------|
| Employee post-login redirect | Dekket av `postLoginRedirectSafety.test.ts` |
| Employee direct route access (path) | Dekket av `employeeAppSurface.test.ts` |
| Torsdag 08:00 / fredag 15:00 (uke) | `weekAvailability.test.ts` |
| Employee order window payload | Ikke egen test i denne kjøringen — eksisterende API-tester kan utvides i Fase 2 |
| Onboarding pending / superadmin activate / roller | Eksisterende suiter — ikke alle kjørt i denne deltreffen |

## Blokkere før Fase 2

1. **`build:enterprise` må fullføres** i miljø med nok Node-heap (eller juster CI/agent RAM).
2. Eventuelt kjør full `npm run test:run` + `npm run lint` som én gate når minne er løst.
