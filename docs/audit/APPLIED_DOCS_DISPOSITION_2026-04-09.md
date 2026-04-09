# Applied docs disposition — execution record

**Date:** 2026-04-09  
**Binding reference:** `docs/audit/BINDING_DISPOSITION_SUPABASE_DOCS_ARTIFACTS_2026-04-09.md`

## What was done

| Item | Detail |
|------|--------|
| **Source list** | `git ls-files --others --exclude-standard`, normalized to `/`, filtered to paths under explicit **KEEP** roots + `docs/supabase-nextjs-audit-report.md` |
| **KEEP roots used** | `docs/umbraco-parity/`, `docs/cms-control-plane/`, `docs/umbraco-migration/`, `docs/audit/`, `docs/repo-audit/`, `docs/phase2/`, `docs/phase2a/`, `docs/phase2b/`, `docs/phase2c/`, `docs/phase2d/`, `docs/refactor/`, `docs/hardening/`, `docs/live-ready/`, `docs/enterprise-ready/`, `docs/decision/`, `docs/product/`, `docs/security/`, `docs/sales/`, `docs/investor/`, `docs/integrations/` + single file `docs/supabase-nextjs-audit-report.md` |
| **Files staged & committed** | **1232** paths — all **new** (`A` in index); **no** tracked docs-diff staged |
| **Excluded by policy** | Any `docs/**` not under KEEP roots (none matched in untracked set — all **1232** untracked `docs/**` paths were inside KEEP); **artifacts/**, **supabase/**** not touched |
| **Docs commit** | `658c6fbf786d4c15da2aa496854e9005e478cc19` — `docs: commit KEEP-classified untracked tree` |
| **Staging** | `git add --pathspec-from-file=.tmp-docs-keep.txt` (UTF-8 **no BOM**); `.tmp-docs-keep.txt` **deleted** after commit |
| **Verification** | Staged count **1232**; all paths `docs/*`; every path either equals `docs/supabase-nextjs-audit-report.md` or starts with a KEEP root; **no** paths outside `docs/` |

## What this is not

- **Not** baseline freeze.
- **Not** proof / CI evidence capture.
- **Not** resolution of **tracked** working-tree diff (including modified tracked `docs/*` such as `docs/MEDIA_API_CONTRACT.md` if present).
- **artifacts/** and **supabase/migrations/** remain **HOLD OUTSIDE BASELINE NOW** per prior binding.

## Post-state (`docs/**`)

- **Untracked under `docs/`** after commit: **0** (this snapshot).
- **Tracked docs with local modifications** may still exist — **not** part of this commit.

## Gates (post-docs-commit)

On `658c6fbf786d4c15da2aa496854e9005e478cc19`:

| Command | Result |
|--------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (warnings only) |
| `npm run test:run` | PASS — 359 test files passed, 4 skipped |
| `npm run build:enterprise` | PASS — SEO gates OK |

## Next package (single)

**Name:** `owner decision on remaining tracked product diff`  

**Why:** Untracked **KEEP** `docs/**` and **KEEP** `lib/**` are now historisert; the largest remaining **revision dishonesty** is typically the **large tracked dirty tree** (components, app, tests, workflows, etc.) that was explicitly out of scope for docs/lib apply packages.  

**Closes:** Bindende disposisjon og/eller kontrollert commit-strategi for **tracked** endringer — uten å blande inn artifacts/supabase HOLD-bøtter før de har egen pakke.
