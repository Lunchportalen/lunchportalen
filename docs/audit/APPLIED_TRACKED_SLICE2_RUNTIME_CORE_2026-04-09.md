# Applied tracked diff — slice 2 (runtime / core)

**Date:** 2026-04-09  
**Binding reference:** `docs/audit/BINDING_DISPOSITION_TRACKED_DIRTY_TREE_2026-04-09.md`  
**Prior slice:** `docs/audit/APPLIED_TRACKED_SLICE1_TOOLING_TESTS_2026-04-09.md`

## What was committed

| Item | Detail |
|------|--------|
| **Parent HEAD** | `1d05f1ea9ad168df194b870c72887b8ef9200cdb` |
| **Commit** | `24bec71a9b11ba252b7dc16db9db0e6396eae18f` |
| **Message** | `runtime/core: commit tracked KEEP slice` |
| **Files** | **8** |
| **Insertions / deletions** | +88 / −294 |

### Paths included (exact)

- `middleware.ts`
- `plugins/coreBlocks.ts`
- `src/components/nav/HeaderShell.tsx`
- `src/lib/guards/assertCompanyActiveApi.ts`
- `studio/lunchportalen-studio/README.md`
- `studio/schemaTypes/index.ts`
- `studio/schemas/weekPlan.ts`
- `studio/src/tools/WeekPlanner.tsx`

### Explicitly excluded (not in this commit)

- `components/**` (repo root — frozen split bucket)
- `superadmin/system/repairs/run/route.ts` (**HOLD**)
- Tracked `docs/**`
- `tests/**`, `e2e/**`, `.github/workflows/**`, `scripts/**`, slice-1 config files
- **Untracked** tree (unchanged)

### Staging / verification

- `.tmp-runtime-core-slice.txt` — UTF-8 **no BOM** — **deleted** after commit.
- Staged paths verified: each path either in fixed four-file allowlist or `studio/*` prefix; **no** `components/*`, `docs/*`, `tests/*`, `superadmin/*`.

### Post-commit dirty tree

- `git diff --name-only`: **65** files remain (73 − 8).

## What this is not

- **Not** baseline freeze.
- **Not** `components/**` disposition (still **MUST SPLIT**).
- **Not** resolution of superadmin repairs **HOLD**.

## Gates (post-commit)

On `24bec71a9b11ba252b7dc16db9db0e6396eae18f`:

| Command | Result |
|--------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (warnings only) |
| `npm run test:run` | PASS — 359 test files passed, 4 skipped |
| `npm run build:enterprise` | PASS — SEO gates OK |

## Next package (single)

**Name:** `apply tracked docs slice`  

**Why:** Remaining KEEP-diff still includes **tracked `docs/MEDIA_API_CONTRACT.md`**, `docs/audit/U114_...`, `docs/backoffice/...` — small, isolerbar, og eksplisitt utenfor runtime/core.  

**Closes:** Historiserer tracked dokumentasjonsdiff uten å blande inn `components/**` eller repairs-HOLD.
