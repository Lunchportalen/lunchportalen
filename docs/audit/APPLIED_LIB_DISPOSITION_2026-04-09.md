# Applied lib disposition — execution record

**Date:** 2026-04-09  
**Binding reference:** `docs/audit/BINDING_DISPOSITION_UNTRACKED_LIB_2026-04-09.md`

## What was done

| Item | Detail |
|------|--------|
| **Source list** | `git ls-files --others --exclude-standard`, filtered to `lib/*`, **excluding** `lib/repo/*` |
| **Files staged & committed** | **938** paths, all new (`create mode 100644`) under `lib/**` |
| **Excluded by policy** | **`lib/repo/query.ts`** — remains **untracked** (HOLD OUTSIDE BASELINE NOW) |
| **Product commit** | `f5a568d6bda21caed8ab699389386889f786a78a` — message: `lib: commit KEEP-classified untracked tree` |
| **Not in this commit** | Any **tracked** working-tree diff (`app/**`, `components/**`, `tests/**`, `docs/**`, etc.) |
| **Staging mechanism** | `git add --pathspec-from-file=.tmp-lib-keep.txt` (UTF-8 **no BOM**); temp file **deleted** after commit |
| **Verification** | `git diff --cached --name-only` after staging: **938** entries; filter for `not lib/*` or `lib/repo/*` → **empty** |

## What this is not

- **Not** a baseline freeze.
- **Not** proof or CI packaging.
- **Not** resolution of remaining untracked `docs/**`, `artifacts/**`, `supabase/migrations/**`, or the large **tracked** product diff.

## Post-state (lib)

- **Remaining untracked under `lib/`:** `lib/repo/query.ts` only (in this snapshot).
- **Tracked `lib/**` diff:** unchanged by this package — still present in working tree if it existed before; **not** staged here.

## Gates (post-commit)

On `f5a568d6bda21caed8ab699389386889f786a78a`:

| Command | Result |
|--------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (warnings only) |
| `npm run test:run` | PASS — 359 test files passed, 4 skipped |
| `npm run build:enterprise` | PASS — SEO gates OK |

## Next package (single)

**Name:** `apply docs disposition`  

**Why:** Prior binding (`BINDING_DISPOSITION_SUPABASE_DOCS_ARTIFACTS_2026-04-09.md`) classifies **`docs/**` as KEEP**; large untracked `docs/**` mass remains the next structural honesty gap after `lib/**` KEEP landede.  

**Closes:** Historisering av KEEP-klassifisert `docs/**` (egen pathspec/disiplin — ikke bland med produktkodecommit).
