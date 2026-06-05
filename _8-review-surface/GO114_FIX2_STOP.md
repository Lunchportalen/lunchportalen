# GO #114-FIX2 — STOP

## A. Diagnostikk ut av gate + pngjs

- **Fjernet** `Characterize screenshot red` fra `.github/workflows/ci-week-visual.yml` (diagnose feller ikke lenger jobben).
- **On-demand:** `npm run e2e:characterize-screenshot-red [actualRoot]`
- **devDependencies:** `pngjs`, `pixelmatch` (+ `package-lock.json`)
- Script: padded compare + `heightDeltaPx` i output

## B. Reflow-fiks (kun CSS, markør-box)

`app/styles/employee-week.css` — per-variant footprint som pre-STEG 8 glyfer:

| Variant | Wrapper | Ikon |
|---------|---------|------|
| ordered | block, 11px høyde, font-size 12px (probe) | 12×12px |
| locked | inline-flex 14px | 12×12px |
| unavailable | 14px høyde + letter-spacing 0.08em, font-size 12px | 12×12px |

Rad-høyde i kalender uendret vs. blandet uke-rad (max 14px markør-linje). Ingen probe-endring.

**Re-karakterisering:** Kjør på **nye** Linux actuals etter deploy (gamle #105 actuals reflekterer pre-fix CSS). Forventet: `heightDeltaPx ≈ 0`, `globalTopShift: false`, diff konsentrert i `calendar_band` (ikon-delta).

## C. Full suite probe 3×

Uendret `e2e/week-icon-probe.e2e.ts` (`expect.poll`). Verifiseres på neste CI-push.

## D. Eyes-on clips

CI-steg `STEG 8 eyes-on element clips` kjører etter box-fiks → `steg8-review-surface` artefakt med fire `*-actual-crop.png`.

## Ikke gjort

- Ingen baseline · ingen merge · `supabase-migrate.yml` urørt
