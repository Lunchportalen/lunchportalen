# LUNCHPORTALEN — Design layer

Single source of truth for visual primitives used across public, backoffice, and CMS editor.

## Canonical sources

- **CSS variables:** `app/globals.css` (`:root` and `[data-resolved-theme="dark"]`) — `--lp-*` (colors, radius, shadows, ease).
- **Motion:** `lib/ui/motion.css` + `lib/ui/motionTokens.ts` — durations, easing, `.lp-motion-btn`, `.lp-motion-card`, `.lp-motion-overlay`, `.lp-motion-row`, `.lp-motion-switch` / `.lp-motion-switch-thumb` (toggle switches). All respect `prefers-reduced-motion`.
- **Design globals (TS):** `lib/design/globals.ts` — icon sizes, radius reference, CSS var names for use in components.
- **Icon sizes (CSS):** `lib/ui/design.css` — `.lp-icon-sm` (16px), `.lp-icon-md` (20px), `.lp-icon-lg` (24px). Align with `lib/design/globals.ts` `iconSizes`.

## Usage

- Use `--lp-*` in Tailwind via `rgb(var(--lp-text))`, `var(--lp-radius-card)`, etc.
- Use `.lp-motion-*` for interactive surfaces (buttons, cards, overlays, rows, toggle switches).
- Use `.lp-icon-sm` / `.lp-icon-md` / `.lp-icon-lg` for icons so sizing stays consistent.
- Public/backoffice: prefer `.lp-btn`, `.lp-card`, `.lp-nav-item` from globals.css where they fit.

## CMS / design tree

There is no site-wide “design tree” or theme config UI in the repo. Per-block styling (e.g. banner style, alignment) lives in the CMS block model and editor UI. Visual primitives (tokens, motion, icon sizes) are centralized here so that any future design-tree or theme controls can reference the same layer instead of scattered one-off styles.
