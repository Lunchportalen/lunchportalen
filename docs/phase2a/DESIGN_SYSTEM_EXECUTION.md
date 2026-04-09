# Phase 2A — Design system execution

## Objectives

- Strengthen **one** canonical visual layer for CMS/backoffice using existing `--lp-*` CSS variables and `lib/design/tokens.ts` Tailwind fragments.
- Avoid parallel naming systems; document fragmentation where it still exists (see `DESIGN_TOKEN_MAP.md`).

## What was consolidated

1. **Shell surfaces**
   - `cmsWorkspaceMainSurfaceClass` (existing): main column warm neutral.
   - **New** `cmsSectionTreeAsideClass`: combines `lp-glass-panel` with `border-r border-[rgb(var(--lp-border))]` so tree vs workspace separation is consistent and reusable.

2. **Backoffice chrome**
   - Root shell uses `--lp-bg` (aligned with `app/globals.css` warm cream).
   - Top navigation active state uses `--lp-hotpink` for the underline only (AGENTS F6: accent on navigation affordance, not large fills).
   - **V3:** `TopBar` background uses **`--lp-chrome-bg`** (RGB) instead of hardcoded `slate-900`; plum/blekk alias **`--lp-ink-plum`** dokumentert for typografi/dyp kontrast.

3. **Visual DNA (V3)**
   - Se `LUNCHPORTALEN_VISUAL_DNA.md` og `PHASE2A_VISUAL_REFERENCE_NOTES.md` (GetInspired/Stormberg stemning oversatt til LP, ikke kopiert).

4. **DS primitives location**
   - `DsButton`, `DsCard`, `DsBadge`, `DsEmptyState`, `DsToolbar`, `DsIcon` live under **`src/components/ui/ds`**; implementations consume `@/lib/design/tokens` (`focusRing`, `radius`, `motion`, etc.) — unchanged contract.

5. **Layout primitive**
   - `PageContainer` canonical in **`src/components/layout`**.

## What was not changed

- Ingen **parallell** theme-fil; nye variabler er **alias/utvidelser** i samme `:root`-blokk (`--lp-chrome-bg`, `--lp-ink-plum`).
- `lib/design/tokens.ts` structure (still the Tailwind fragment source for DS components).
- No new “theme object” or second token file for CMS.

## Follow-up (non-blocking)

- Gradually replace ad-hoc `pink-500` / `slate-*` in isolated components with `--lp-*` where it does not risk visual regression (tracked in `PHASE2A_REMAINING_DEBT.md`).
