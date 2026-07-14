# PHASE 14B.1 — Week Visual Regression Evidence

## Classification

**INTENTIONAL_APPROVED_UI_CHANGE** + **STALE_BASELINE**

Linux Docker baselines under `e2e/week-visual-regression.e2e.ts-snapshots/` were last updated in `45e23f6d` (Varsler toggle). Subsequent RC commits changed `/week` employee surface without rebaseline:

| Commit | Change |
|---|---|
| `778bdf53` | Employee week language switcher UX (header LocaleSwitcher) |
| `dbf3dc41` | Provider-approved menu translations for employees |
| `b95960f6` | Weekly bulk ordering (`WeekBulkOrderCard` — «Bestill hele uken») |
| `9da6ba72` | Localized tier display labels |

## CI failure (run `29362372288`, PR #489 @ `69ceabbc`)

All **8** screenshot tests failed with **dimension mismatch** (not flaky pixel noise):

| Test | Desktop height (expected → actual) | Mobile height (expected → actual) |
|---|---|---|
| allergen declared_empty | 1615 → 1871 (+256) | 1783 → 2079 (+296) |
| allergen has_data | 1617 → 1873 (+256) | 1785 → 2081 (+296) |
| day selected Tue 02 | 1724 → 1980 (+256) | 1892 → 2188 (+296) |
| ordered + upcoming | 1780 → 2036 (+256) | 1948 → 2244 (+296) |

Screenshot scope: `main.lp-main` only (`weekMainLocator`).

## New DOM regions in actual render (not in baselines)

1. **LocaleSwitcher** in global header (`combobox "Velg språk"`, 15 locales)
2. **Language explainer note** under H1 (`Språkvalg oversetter godkjente menytekster…`)
3. **WeekMenuNotificationToggle** («Varsler» — email checkbox)
4. **WeekBulkOrderCard** («Bestill hele uken»)
5. Expanded allergen disclosure copy (provider-approved translation context)

## Visual contract verification (Gate 2)

- Layout change is **intentional** RC scope (i18n + ordering)
- No raw i18n keys visible in DOM snapshot
- Norwegian (`nb-NO`) locale; no mixed-language leak
- Mock fixtures still deterministic (Oslo clock pinned, `/api/week` mocked)
- No employee price/commercial data in screenshots
- Animations disabled; `waitForWeekVisualReady` gates screenshot

## Product defect

**No** — product matches approved RC UI. Baselines were stale relative to shipped surface.

## Baseline regeneration

Authoritative capture: **Playwright Docker** `mcr.microsoft.com/playwright:v1.58.2-noble` (same as CI).

Regenerated via GitHub Actions workflow_dispatch `CI Week Visual` with `update_snapshots: true` on branch `release/global-invoice-only-foundation`:

- Run: https://github.com/Lunchportalen/lunchportalen/actions/runs/29366493358
- Conclusion: **success** (8/8 screenshots updated, 0 diff after update)

Files updated (8 PNGs only):

- `e2e/week-visual-regression.e2e.ts-snapshots/week-visual-desktop/*.png` (4)
- `e2e/week-visual-regression.e2e.ts-snapshots/week-visual-mobile/*.png` (4)
