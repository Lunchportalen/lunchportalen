# GO #114-FIX2 — STOP

**HEAD:** `3c6888a6` (strut reverted in follow-up → footprint `213e4831`) · **PR:** #114

## A. pngjs + diagnostikk ut av gate ✅

| Endring | Status |
|---------|--------|
| `Characterize screenshot red` fjernet fra `ci-week-visual.yml` | ✅ |
| `pngjs` + `pixelmatch` i `devDependencies` | ✅ |
| On-demand: `npm run e2e:characterize-screenshot-red [test-results]` | ✅ |
| Script: padded compare + `heightDeltaPx` | ✅ |

Diagnose kan ikke felle week-visual-jobben.

## B. Reflow / markør-box ⚠️

**Første fiks (`213e4831`):** per-variant footprint (ordered 11px, locked/unavailable 14px, ikon 12×12).

**Linux re-char (run `26987695708`, pre-strut):**

| Snapshot | heightDelta | top | allergen_band | calendar_band |
|----------|-------------|-----|---------------|-----------------|
| declared-empty d | **−23** | 0 | 11304 | 25713 |
| has-data d | **−23** | 0 | 11304 | 23584 |
| declared-empty m | **−22** | 0 | 6001 | 12463 |

`globalTopShift`: **nei**. Diff ikke kun markør-piksler (ikon-glyf + layout).

**Strut-forsøk (`3c6888a6`, `::after` + absolutt ikon):** heightDelta **−28** (verre) — **revertet** til footprint `213e4831`.

**Konklusjon B:** Markør-box alene når ikke `heightDelta ≈ 0` mot STEG 7.1-baseline. Gjenstående delta er side-layout (baseline pre-STEG 8). **Ikke baseline** — klassifiser som **ikon-delta i calendar_band**; `allergen_band`-diff er reflow-kaskade til baseline er oppdatert med STEG 8.

## C. Full suite probe 3× ✅ (probe uendret)

| Run | SHA | Resultat |
|-----|-----|----------|
| `26987695708` | `213e4831` | **3/3** `allPass: true` |
| `26988286487` rerun | `3c6888a6` | **3/3** `allPass: true` (run 2/3 flaket første gang) |

`expect.poll` Mon→slot-klokke uendret.

## D. Fire Docker element-clips ✅

Artefakt `steg8-review-surface` (rerun `26988286487`):

- `locked-pill-clock-actual-crop.png`
- `unavailable-cell-minus-actual-crop.png`
- `ordered-calendar-check-actual-crop.png`
- `locked-collapse-clock-actual-crop.png`

## Ikke gjort

- Ingen baseline · ingen merge · `supabase-migrate.yml` urørt

**CI-jobb:** kan fortsatt være **rød** på screenshot-diff (forventet ikon-delta); **grønn** på probe-gate + ingen diagnose-krasj.
