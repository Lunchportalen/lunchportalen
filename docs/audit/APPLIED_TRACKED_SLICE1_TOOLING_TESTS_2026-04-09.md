# Applied tracked diff — slice 1 (tooling / tests / e2e / CI / scripts)

**Date:** 2026-04-09  
**Binding reference:** `docs/audit/BINDING_DISPOSITION_TRACKED_DIRTY_TREE_2026-04-09.md`

## What was committed

| Item | Detail |
|------|--------|
| **Parent HEAD** | `956901d0d8f0fe43dc6495d225ce84960a686a94` |
| **Commit** | `bb67843d4ed6bd85ed0b6ab2c6e2469e8a33f3a9` |
| **Message** | `tooling/tests: commit KEEP-classified tracked slice` |
| **Files** | **99** (source: `git diff --name-only` ∩ allowlist) |
| **Insertions / deletions** | +3946 / −922 (from `git commit` summary) |

### Paths included (policy)

- `tests/**`
- `e2e/**`
- `.github/workflows/**`
- `scripts/**`
- `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `next.config.ts`, `playwright.config.ts`, `.eslintrc.cjs`, `.gitignore`, `.env.example`, `next-env.d.ts`, `tailwind.config.cjs`

### Explicitly excluded (not in this commit)

- `components/**`
- `superadmin/system/repairs/run/route.ts` (HOLD)
- `middleware.ts`
- `plugins/coreBlocks.ts`
- `studio/**`
- `src/components/nav/HeaderShell.tsx`
- `src/lib/guards/assertCompanyActiveApi.ts`
- Tracked `docs/**` diff
- All **untracked** paths (unchanged)

### Staging / verification

- Pathspec file `.tmp-tracked-slice.txt` — UTF-8 **no BOM** — **deleted** after commit.
- `git diff --cached --name-only`: **99** paths; brute filter for any path **not** in allowlist → **empty**.

### Post-commit dirty tree

- `git diff --name-only` (vs new HEAD): **73** files remain changed (172 − 99).

## What this is not

- **Not** baseline freeze.
- **Not** resolution of `components/**` (MUST SPLIT) or superadmin repairs HOLD.
- **Not** artifacts / supabase untracked handling.

## Gates (post-commit)

On `bb67843d4ed6bd85ed0b6ab2c6e2469e8a33f3a9`:

| Command | Result |
|--------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (warnings only) |
| `npm run test:run` | PASS — 359 test files passed, 4 skipped |
| `npm run build:enterprise` | PASS — SEO gates OK |

## Next package (single)

**Name:** `apply tracked runtime/core slice`  

**Why:** Slice 1 removed test/CI/tooling noise; next **KEEP** bundle per disposition is **runtime + CMS adjacency** without touching **MUST SPLIT** `components/**` or **HOLD** repairs: `middleware.ts`, `plugins/coreBlocks.ts`, `studio/**`, `src/components/nav/HeaderShell.tsx`, `src/lib/guards/assertCompanyActiveApi.ts`, tracked `docs/**` — still **73** files on disk; group as one honest «runtime/core» commit after pathspec verify.  

**Closes:** Historiserer gjenværende ikke-komponent produktnær kode og tracked docs-diff, fortsatt **uten** `components/**` og **uten** `superadmin/system/repairs` inntil HOLD er løst.
