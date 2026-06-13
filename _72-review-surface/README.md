# STEG 7.2 review surface — GO 7.2-FIX (eyes-on STOP)

**PR:** [#112](https://github.com/Lunchportalen/lunchportalen/pull/112)  
**Pre-flight:** `feat/week-steg-7-2-ordered-collapse` · `main` = `3cbfbd0c` (ingen 7.2-merge)  
**Authoritative screenshot CI (pre-FIX commit):** run `26959487078`  
**Ingen baseline · ingen merge** — egen GO `#-MERGE` etter eyes-on.

---

## 1. V.W7 — locked/editable probes (post FIX)

See `WEEK_COLLAPSE_PROBE.json`.

### Editable (ordered before cutoff, Tir 02.06)

| Krav | Assert |
|------|--------|
| Sammendrag «Bestilt: …» | `summaryText` inneholder rett |
| «Endre» + `aria-expanded` disclosure | visible → klikk → `true`, picker synlig |
| ≥1 slot ikke `aria-disabled` | `slotProbe.allEditable` |

### Locked (ordered after cutoff, Man 01.06)

| Krav | Assert |
|------|--------|
| Ingen «Endre» | `endreCount === 0` + `getByRole("button", {name:/endre bestilling/i}).toHaveCount(0)` |
| Synlig label én gang | `lockedNoteText === "Frist passert"` (sr-only kun supplement) |
| Perceivable affordance (WCAG 1.4.1) | `assertPerceivableAffordance` på `.ds-week-ordered-collapse__locked-note__label` — height>0, ikke sr-only |
| Picker kan ikke åpnes | `pickerGate`: ingen edit, ingen `aria-controls`, picker hidden/absent, 0 synlige slot-kontroller i kollaps |
| **Fjernet** | `allSlotsAriaDisabled` på `slotCount:0` (vacuous `[].every()`) |

**V.W6 uendret:** `WEEK_STATE_PROBE_LOCKED_SLOTS` (locked uten ordre: opacity + aria-disabled + «Frist passert» på slots).

---

## 2. week-visual — CI truth (run 26959487078)

| Snapshot | Resultat | Playwright |
|----------|----------|------------|
| `week-ordered-upcoming` desktop | **RØD** (forventet) | **8240** pixels (**ratio 0.01**) · 1280×1546 = 1280×1546 |
| `week-ordered-upcoming` mobile | **RØD** (forventet) | **15672** pixels (**ratio 0.03**) · expected **375×1687**, received **375×1549** |
| øvrige 6 snapshots | grønn | ingen lekkasje |

Artifacts (Playwright `-diff.png` fra CI, ikke lokalt `gen-week-visual-diff-surface`):

- `week-ordered-upcoming-week-visual-desktop-diff.png`
- `week-ordered-upcoming-week-visual-mobile-diff.png`

---

## 3. Diff-masse karakterisering (read-only, desktop CI expected↔actual)

Script: `scripts/e2e/characterize-week-diff-regions.mjs` (pixelmatch, diffColor-only bbox).

| Felt | Verdi |
|------|-------|
| `globalTopShift` | **false** |
| `verdict` | **LOCALIZED_ORDERED_DAY_REGION** |
| Top (H1/eyebrow, y0–220) | **identical** (0 diff pixels) |
| Kalender (y220–380) | **identical** (0 diff pixels) |
| Bounding box (mismatch) | minX **321**, minY **675**, maxX **939**, maxY **1500** (619×826) |
| day_panel + kommende_dager | diff konsistent med kollaps (picker → kompakt «Bestilt») |

**Binært:** diff **ikke** global layout-shift i topp/kalender → **benign kollaps-kaskade** (7.2-presentasjon).  
**Blokkerer ikke** merge-port på global-shift-grunnlag.

Mobile: høyde-Δ **−138px** (1687→1549) — forventet fra kollaps; region-script krever samme dimensjon (dimensjonMismatch).

---

## 4. Server-side 08:00 gate (uendret av 7.2)

| Lag | Fil | Avvisning |
|-----|-----|-----------|
| Klient write | `EmployeeWeekClient.tsx` → `POST /api/orders` (`postSetDayInner` ~1865) | UI-fjerning av «Endre» = defense-in-depth |
| HTTP + RPC | `app/api/orders/route.ts` ~358 `lp_order_set` → `mapOrderWriteError` | `CUTOFF_PASSED` → **409**, melding «Fristen for i dag er passert (kl. 08:00).» (`lib/orders/mapOrderWriteError.ts` 149–156) |
| Alternativ stier | `app/api/orders/toggle/route.ts` 89–90, `cancel/route.ts` 194–195 | **403** `CUTOFF_LOCKED` via `cutoffStatusForDate` |

`git diff 3cbfbd0c..HEAD` rører **ikke** cutoff-sjekk i write/RPC — kun `collapseOrderedPicker` + presentasjon.

---

## 5. Gates etter FIX-commit

Kjør på ny CI etter push: **9/9** probes (V.W2–V.W7), **6/8** screenshots (kun ordered-upcoming rød).

**STOP** — eyes-on: denne README + JSON + diff-PNG + ny `WEEK_COLLAPSE_PROBE_LOCKED` i CI-logg.
