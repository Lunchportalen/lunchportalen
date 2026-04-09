# Phase 1C — Gjenværende teknisk gjeld (eksplisitt)

## Build / lint

- `next build` rapporterer mange **ESLint warnings** (react-hooks/exhaustive-deps, `@next/next/no-img-element`, …) — ikke blokkende, men støy i logg.
- Svært stor kodebase: byggetiden er lang (~10–15+ min `next build` compile på utvikler-PC).

## ContentWorkspace

- `ContentWorkspace.tsx` er fortsatt monolittisk for state/hooks; kun composition + `ContentWorkspaceEditorMountRouter` er strukturert ut.
- Publish rail, inspector og canvas er **ikke** egne toppnivå-filer ennå.

## Komponentrot

- `components/AppFooter.tsx`, `components/auth/*`, `components/ui/*`, m.fl. ligger fortsatt under rot-`components/` (alias faller tilbake når `src/` mangler fil).

## Tester

- Full `npm run test:run` + `test:tenant` er ikke kjørt som del av denne leveransen (kun målrettede auth-/route-tester + typecheck + build:enterprise).

## Dokumentasjon / drift

- Eldre interne notater kan fortsatt referere til `isFri1400` i uke-synlighet — kode bruker `isFri1500` (jf. `app/api/cron/week-visibility/route.ts`).
