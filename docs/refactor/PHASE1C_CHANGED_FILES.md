# Phase 1C — Endrede / nye filer

## Build & CI

- `package.json` — `NODE_OPTIONS=--max-old-space-size=8192` for `build` og `build:enterprise` (`next build`)
- `.github/workflows/ci.yml` — `NODE_OPTIONS` på job
- `.github/workflows/ci-enterprise.yml` — `NODE_OPTIONS`
- `.github/workflows/ci-e2e.yml` — `NODE_OPTIONS`
- `.github/workflows/ci-agents.yml` — `NODE_OPTIONS` på build-steg

## Komponenter (slice 2)

- `src/components/layout/PageSection.tsx` (ny, flyttet innhold)
- `components/layout/PageSection.tsx` (re-export)
- `src/components/week/WeekMenuReadOnly.tsx` (ny, flyttet innhold)
- `components/week/WeekMenuReadOnly.tsx` (re-export)

## ContentWorkspace

- `app/(backoffice)/backoffice/content/_components/ContentWorkspaceEditorMountRouter.tsx` (ny)
- `app/(backoffice)/backoffice/content/_components/ContentWorkspacePageEditorShell.tsx` (bruker router)

## Employee routes

- `app/min-side/page.tsx` — eksplisitt `employee` → `redirect("/week")`

## Tester

- `tests/auth/employeeDirectRouteBehavior.test.ts` (ny)
- `tests/auth/employeeOrdersRedirect.test.ts` (ny)
- `tests/auth/employeeMinSideRedirect.test.ts` (ny)

## Dokumentasjon

- `docs/refactor/PHASE1C_BUILD_HARDENING.md`
- `docs/refactor/PHASE1C_EMPLOYEE_DIRECT_ROUTE_PROOF.md`
- `docs/refactor/PHASE1C_COMPONENT_ROOT_SLICE2.md`
- `docs/refactor/PHASE1C_CONTENTWORKSPACE_DEEPER_SPLIT.md`
- `docs/refactor/PHASE1C_CHANGED_FILES.md` (denne)
- `docs/refactor/PHASE1C_REMAINING_DEBT.md`
- `docs/refactor/PHASE1_READY_FOR_PHASE2.md`
- `docs/refactor/PHASE1C_VERIFICATION.md`
