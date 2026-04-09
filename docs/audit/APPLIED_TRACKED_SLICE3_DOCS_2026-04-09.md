# Applied tracked diff — slice 3 (docs only)

**Date:** 2026-04-09  
**Binding reference:** `docs/audit/BINDING_DISPOSITION_TRACKED_DIRTY_TREE_2026-04-09.md`  
**Prior slices:** `docs/audit/APPLIED_TRACKED_SLICE1_TOOLING_TESTS_2026-04-09.md`, `docs/audit/APPLIED_TRACKED_SLICE2_RUNTIME_CORE_2026-04-09.md`

## What was committed (docs slice only)

| Item | Detail |
|------|--------|
| **Parent HEAD** | `f0de90a490e7b24c17a9a0a7d0ab272e1509cbc5` |
| **Commit** | `b67cacba37e2707e3eab295c49561eddcc8d6317` |
| **Message** | `docs: commit tracked KEEP slice` |
| **Files** | **3** |
| **Insertions / deletions** | +87 / −98 |

### Paths included (exact)

- `docs/MEDIA_API_CONTRACT.md`
- `docs/audit/U114_scoped_baseline_prep_record.md`
- `docs/backoffice/HOME_NODE_BEHAVIOR.md`

### Explicitly excluded (not in the docs slice commit)

- **This audit file** — committed in a **separate** commit after the docs slice.
- `components/**` (still **MUST SPLIT BEFORE DECISION**)
- `superadmin/system/repairs/run/route.ts` (**HOLD**)
- `middleware.ts`, `plugins/coreBlocks.ts`, `studio/**`, `src/components/nav/HeaderShell.tsx`, `src/lib/guards/assertCompanyActiveApi.ts` (already historisert i slice 2)
- `tests/**`, `e2e/**`, `.github/workflows/**`, `scripts/**`, slice-1 configfiler
- **Untracked** tree (unchanged; ikke rørt)

### Staging / verification

- Kilde: `git diff --name-only` → filtrert til `docs/` → `.tmp-tracked-docs-slice.txt` (UTF-8 **uten BOM**) → `git add --pathspec-from-file=...`.
- Verifisert: alle staged paths under `docs/`; ingen paths utenfor `docs/`.
- **Merk:** Etter `git add`, matcher ikke `git diff --name-only` (kun unstaged) lenger de fullstagede filene; verifikasjon mot «før staging» ble gjort ved å sammenligne staged sett med den opprinnelige listen (3 paths) og med `git diff HEAD --name-only` for konsistens.
- Midlertidig pathspec-fil **slettet** etter staging (før/ved npm-kjede).

### Post-commit tracked dirty tree

- `git diff --name-only`: **62** filer gjenstår (65 − 3). Ingen tracked `docs/**` igjen i den listen for denne operasjonen.

## What this is not

- **Ikke** baseline freeze.
- **Ikke** proof, CI/e2e-plan eller generell «rydding».
- **Ikke** `components/**`-disposisjon eller repairs-HOLD-løsning.

## Gates (etter docs-commit `b67cacb…`)

Kjørt i rekkefølge: `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build:enterprise`.

| Command | Result |
|--------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (kun advarsler) |
| `npm run test:run` | PASS — 359 testfiler passert, 4 hoppet over |
| `npm run build:enterprise` | PASS (exit 0) |

## Next package (single)

**Navn:** Split tracked `components/**` før beslutning (klassifiser/commit i mindre KEEP-slices etter binding).

**Hvorfor:** Binding sier `components/**` er **MUST SPLIT BEFORE DECISION**; tracked diff er nå domineret av denne bøtta pluss repairs-HOLD.

**Lukker:** Forbereder ærlig beslutning om root-`components/**` vs resten uten å blande inn docs eller runtime/core som allerede er historisert.
