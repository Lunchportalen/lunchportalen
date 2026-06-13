# GO #114 — STOP

**Branch:** `feat/week-steg-8-vw8-stabilize` · **PR:** https://github.com/Lunchportalen/lunchportalen/pull/114  
**CI:** https://github.com/Lunchportalen/lunchportalen/actions/runs/26982933911

## 1. Root-cause

**Flake = `slotClockProbe`-sub-probe**, ikke de tre kalender-markørene.

| Del | Deterministisk? |
|-----|-----------------|
| locked / ordered / unavailable `.ds-week-icon` | **Ja** (DOM-eval før Mon-tap) |
| `slotClockProbe` | **Nei før fix** — `waitFor(.week-category-card__state-icon)` + CUTOFF-revert (panel ≠ Mon locked) |

## 2. Fix (kun probe)

- `selectWeekDay("2026-06-02")` som V.W6
- Fjernet `waitFor` på slot-klokke → umiddelbar `page.evaluate`
- `labelText` ~ `/frist passert/i`
- **Ingen** endring i ikon/CSS

## 3. V.20 — 3× determinisme (Linux)

`VW8_DETERMINISM.json`: **3/3 grønn**, `allPass: true` (run `26982933911`).

## 4. WEEK_ICON_PROBE (full)

Se `WEEK_ICON_PROBE.json` — 12×12 kalender, slot-klokke 12.12px, `treatmentsMatch: true`, 5.4 ::after uendret.

## 5. Eyes-on clips

- CI-steg **grønn** (`locator.screenshot`, 2.8s)
- Artefakt manglet PNG første leveranse (upload-glob); rettet → ny CI for `*-actual-crop.png`
- **Forkast** lokale bbox-crops i `_8-review-surface/`

## Utenfor denne GO

- Week-visual screenshots **rød** (stale glyf-baseline + auth-flake i lang kjøring) — **ingen baseline** her
- Neste: eyes-on-GO → FASE 5 baseline → GO #-MERGE
