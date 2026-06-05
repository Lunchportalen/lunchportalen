# GO #114-FIX2 — STOP

## A. Diagnostikk ut av gate + pngjs

- **Fjernet** `Characterize screenshot red` fra `.github/workflows/ci-week-visual.yml` (diagnose feller ikke lenger jobben).
- **On-demand:** `npm run e2e:characterize-screenshot-red [actualRoot]`
- **devDependencies:** `pngjs`, `pixelmatch` (+ `package-lock.json`)
- Script: padded compare + `heightDeltaPx` i output

## B. Reflow-fiks (kun CSS, markør-box)

`app/styles/employee-week.css` — skjult glyf-strut (`::after` ✓ 11px / 14px min / — 14px) + absolutt sentrert `.ds-week-icon` 12×12. `font-size: 12px` på markør beholdes for V.W8.

**Re-karakterisering:** `npm run e2e:characterize-screenshot-red tmp-ci-fix2-report/test-results` etter ny CI (run 213e4831+).

## C. Full suite probe 3×

Uendret `e2e/week-icon-probe.e2e.ts` (`expect.poll`). Verifiseres på neste CI-push.

## D. Eyes-on clips

CI-steg `STEG 8 eyes-on element clips` kjører etter box-fiks → `steg8-review-surface` artefakt med fire `*-actual-crop.png`.

## Ikke gjort

- Ingen baseline · ingen merge · `supabase-migrate.yml` urørt
