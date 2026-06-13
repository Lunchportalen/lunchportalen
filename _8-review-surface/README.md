# STEG 8 review surface — ds-week icon consolidation (eyes-on STOP)

**PR:** https://github.com/Lunchportalen/lunchportalen/pull/113  
**Branch:** `feat/week-steg-8-icon-consolidation` · **base:** `98b517de`  
**CI (authoritative):** run `26973714860` — V.W2–V.W8 + week-visual **8/8 pass**  
**Scope:** presentation only — `employee-week.css` + `EmployeeWeekClient.tsx`  
**Ikke merge her** — egen GO `#-MERGE` etter eyes-on + baseline-protokoll.

---

## STEG 0 — pre-flight

| Sjekk | Status |
|--------|--------|
| `HEAD` = `98b517de` | PASS |
| V.W2–V.W7 i `docs/CONVENTIONS.md` | PASS (syv rader) |
| CI-streng «STEG 5.3–7.2» i CONVENTIONS | PASS (V.W8 formaliseres ved **MERGE-GO**) |
| `supabase-migrate.yml` | Urørt |
| V.W8 probe wired i `ci-week-visual.yml` | PASS (steg «STEG 5.3–8 … + icon») |

---

## Implementasjon (tre markører)

| Tilstand | Før | Etter |
|--------|-----|-------|
| **locked** | `ClockIcon` + fast 12px | `DsWeekIcon` `clock` + `.ds-week-icon` (1em, `currentColor`) — kalender + kollaps-notis |
| **unavailable** | tekst `—` | `DsWeekIcon` `minus` |
| **ordered** (kalender) | tekst `✓` | `DsWeekIcon` `check` |

**Uendret (5.4):** `.week-category-card.is-ordered[aria-pressed="true"]::after` — gull-ring på valgt slot (V.W8 `slotCheckAfter`-vakt).

**A11y:** `aria-hidden="true"` på ikon; `sr-only` / «Frist passert» / «Ikke tilgjengelig» / sammendrag «Bestilt» bærer mening.

---

## Filer i denne mappen (generer lokalt / CI)

| Fil | Innhold |
|-----|---------|
| `WEEK_ICON_PROBE.json` | V.W8: locked / ordered / unavailable + `slotCheckAfter` |
| `week-ordered-upcoming-*-diff.png` | Forventet **rød** (alle tre kalender-markører) |
| `week-allergen-*-diff.png`, `week-day-selected-*-diff.png` | Skal være **0 diff** (lekkasje-guard) |
| `HEIGHT_MANIFEST.json` | `diffPixels` + `heightDeltaPx` per snapshot |

### Kommando (krever `E2E_EMPLOYEE_*` eller `E2E_TEST_USER_*` med employee-rolle)

```powershell
cd c:\prosjekter\lunchportalen
npm run build:enterprise
$env:LP_E2E_EXTERNAL_SERVER="1"
$env:DOTENV_CONFIG_PATH=".env.local"
$env:LP_REVIEW_SURFACE_OUT="_8-review-surface"

# Start server (egen terminal): npm run start

node -r dotenv/config node_modules/@playwright/test/cli.js test `
  --config playwright.week-row-probe.config.ts `
  --project week-visual-desktop `
  --reporter=list

node -r dotenv/config node_modules/@playwright/test/cli.js test `
  --config playwright.week-visual.config.ts `
  --reporter=list

mkdir -Force tmp-week-visual-snapshots
# Kopier faktiske PNG fra test-results til tmp-week-visual-snapshots/… (eller --update-snapshots)

node scripts/e2e/gen-steg8-icon-review-surface.mjs tmp-week-visual-snapshots _8-review-surface
```

**Lokal blokkering (2026-06-04):** `.env.local` har kun `E2E_SUPERADMIN_*` — employee-prober og week-visual **skippes** uten `E2E_EMPLOYEE_EMAIL` / `E2E_TEST_USER_*`.

---

## Eyes-on checklist (STOP før MERGE-GO)

1. **Tre markører** i `week-ordered-upcoming` diff: samme visuelle størrelse/justering (12px em-base).
2. **Farge:** locked/unavailable = `--ds-text-soft` via `currentColor`; ordered = `--ds-accent`.
3. **Slot checkmark (5.4):** uendret gull-ring `::after` (se `WEEK_ICON_PROBE.json` → `slotCheckAfter`).
4. **Lekkasje:** allergen + day-selected diffs **tomme** (`HEIGHT_MANIFEST.json` → `diffPixels: 0` på leak-guard-rader).
5. **Ingen reflow** utenfor markør-/kollapsflate (sammenlign med `_72-review-surface` 7.2-metode ved tvil).

---

## Gates

| Gate | Lokal | CI (etter push + secrets) |
|------|-------|---------------------------|
| typecheck | PASS | |
| build:enterprise | PASS | |
| V.W2–V.W8 | SKIP (mangler employee creds) | forventet grønn |
| week-visual leak-guard | ikke kjørt | 6× grønn, 2× rød ordered-upcoming |
