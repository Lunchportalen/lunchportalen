# Commands Run and Results

**Audit date:** 2026-03-27  
**Repository:** `c:\prosjekter\lunchportalen`  
**Shell:** PowerShell on Windows

## Commands executed

| Command | Exit code | Result |
|--------|-----------|--------|
| `npm run typecheck` (`tsc --noEmit`) | **0** | **PASS** |
| `npm run lint` (`next lint`) | **0** | **PASS with warnings** (see below) |
| `npm run test:run` (Vitest) | **0** | **PASS** — 193 test files, 1133 tests |
| `npm run sanity:live` | **0** | **Soft gate** — localhost unreachable (no dev server); script skipped health fetch |
| `npm run build` (`verify-control-coverage.mjs` + `next build`) | **134** | **FAIL** — Node.js heap out of memory during optimized production build |

## Lint — notable output

- Deprecation notice: `next lint` deprecated in favor of ESLint CLI (Next.js 16 direction).
- Large concentration of **react-hooks/exhaustive-deps** warnings in `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` (dozens of lines referenced).
- Widespread `@next/next/no-img-element` warnings in backoffice/CMS components.

**Evidence:** terminal log captured during audit session; `ContentWorkspace.tsx` hook warnings at lines including 1078, 1374, 1429, … 6390 (see lint output).

## Test run — summary

```
Test Files  193 passed (193)
     Tests  1133 passed (1133)
  Duration  ~66s (environment-dependent)
```

## Build failure — evidence

```
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
Next.js build worker exited with code 134
```

**Interpretation:** On this machine, the production build exceeded default V8 heap (~2 GB implied by GC log). **Not verified** whether CI (Linux, different limits, `NODE_OPTIONS`) completes successfully without OOM.

**Mitigation commonly used:** `NODE_OPTIONS=--max-old-space-size=8192` (or similar). **Ikke kjørt i denne auditen.**

## Not run (and why)

| Command | Reason |
|---------|--------|
| `npm run build:enterprise` | Chained guards + full SEO scripts + build; would likely hit same OOM locally; enterprise gate assumed to match CI when secrets present — **ikke verifisert lokalt**. |
| `npm run e2e` | Requires running app + Playwright; no long-lived dev server started for this audit — **ikke verifisert**. |
| `npm run ci:enterprise` | Superset of above; **ikke verifisert lokalt**. |

## Grep / static scans performed

- Pattern sweeps: `TODO`/`FIXME`/`HACK`, `@ts-ignore`/`@ts-expect-error`, `eslint-disable`, `as unknown as`, `console.log` (counts by file), `: any` patterns, `debugger`.
- File counts: `git ls-files`, `app/api/**/route.ts` route count, `lib/ai` file count, line count of `ContentWorkspace.tsx`.

## Uncertainties (explicit)

- **Production build success** on CI vs local OOM: **ikke verifisert** end-to-end on this host.
- **E2E behavior**: **ikke verifisert** in this pass.
- **Runtime behavior under load** (concurrent mutations, large payloads): mostly **ikke verifisert** beyond existing automated tests.

---

## Delta verification — 2026-03-27 (post CMS FASE 1–15)

| Command | Exit | Notes |
|---------|------|--------|
| `npm run typecheck` | 0 | PASS |
| `npm run lint` | 0 | PASS (warnings unchanged — CMS hooks / `no-img`) |
| `npm run test:run` | 0 | PASS — 193 files, 1133 tests |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run build:enterprise` | **1** | `next build` compiled ~4.4 min; failed at **Collecting page data** with `ENOENT` `.next/server/pages-manifest.json` (Windows/local artefact — **retry** after removing `.next` or compare to CI Linux). |

**Code hygiene in this delta:** `lint:ci` aligned with `next lint`; removed orphan `superadmin/system/repairs/run/route.ts`; tightened `app/api/something/route.ts`; removed `@ts-nocheck` from `tests/cms/publicPreviewParity.test.ts` (see `CURRENT_STATE_DELTA.md`).
