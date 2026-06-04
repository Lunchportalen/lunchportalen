# STEG 7.2 review surface — ordered-day collapse (Modell A)

**Branch:** `feat/week-steg-7-2-ordered-collapse`  
**Base:** `3cbfbd0c` (STEG 7.1 merged)

## Pre-flight (7.1-close) — PASS

| Check | Result |
|-------|--------|
| `main` tip | `3cbfbd0c` |
| V.W6 `height > 0` on visible marks | 6× `assertPerceivableAffordance` in `e2e/week-state-probe.e2e.ts` |
| Slot JSON (merge run) | `WEEK_STATE_PROBE_LOCKED_SLOTS` opacity 0.5 + `aria-disabled` + «Frist passert»; `_UNAVAILABLE_SLOT` opacity 1 + «Ikke tilgjengelig» |
| CONVENTIONS @ 3cbfbd0c | V.W2–V.W6 + «STEG 5.3–7.1» CI-streng |

## Expected week-visual (NO baseline)

`week-ordered-upcoming-*` → **RED** (full picker → kompakt «Bestilt: …» + «Endre»).  
Other 6 snapshots should stay green unless incidental layout shift.

Regenerate diffs after local Playwright actuals:

```bash
# actuals → tmp-week-visual-snapshots/ (Linux paths under week-visual-desktop|mobile/)
node scripts/e2e/gen-week-visual-diff-surface.mjs tmp-week-visual-snapshots _72-review-surface
```

## V.W7 probe log prefixes

- `WEEK_COLLAPSE_PROBE_EDITABLE` — før cutoff, slots endbare etter «Endre»
- `WEEK_COLLAPSE_PROBE_LOCKED` — etter cutoff, ingen «Endre», picker skjult

## Eyes-on STOP

- Kollapset sammendrag leselig, rett synlig («Bestilt: …»)
- «Endre» synlig før cutoff / fraværende etter
- Ingen reflow utenfor dag-flaten

**Do not merge on this GO** — separate `#-MERGE` port after baseline.
