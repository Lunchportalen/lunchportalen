# Visual system — primitives and backoffice cohesion

**Phase 12. No branding rewrite. Accessibility and performance preserved.**

## 1. Design primitives (verified)

### Tokens (app/globals.css)

- **Surfaces:** `--lp-bg`, `--lp-surface`, `--lp-surface-alt`, `--lp-surface-2`, `--lp-card`. Card background for backoffice panels: `--lp-card` (aligns with surface-2; use `bg-[rgb(var(--lp-card))]`).
- **Text:** `--lp-text`, `--lp-fg`, `--lp-muted`.
- **Borders:** `--lp-border`, `--lp-divider`.
- **Radius:** `--lp-radius-card`, `--lp-radius-btn`, `--lp-radius-badge`.
- **Shadows:** `--lp-shadow-card`, `--lp-shadow-soft`, `--lp-shadow-sm`, `--lp-shadow-md`.
- **Ease:** `--lp-ease` (cubic-bezier). Hot pink accent per AGENTS.md F6: one primary action only.

### Motion (lib/ui/motion.css)

- **Durations:** `--lp-duration-fast` (120ms), `--lp-duration-normal` (200ms), `--lp-duration-enter` (220ms).
- **Classes:** `.lp-motion-btn`, `.lp-motion-card`, `.lp-motion-overlay`, `.lp-motion-row`, `.lp-motion-switch`, `.lp-motion-switch-thumb`. All use the same ease and respect `prefers-reduced-motion: reduce` (transition disabled).

### Icons (lib/ui/design.css + lib/design/globals.ts)

- **Sizes:** `.lp-icon-sm` (16px), `.lp-icon-md` (20px), `.lp-icon-lg` (24px). Use these classes for icons; avoid ad-hoc `h-3.5 w-3.5` or mixed pixel sizes so backoffice and editor stay consistent.

### Cards and buttons

- **Cards:** `.lp-card`, `.lp-card--elevated`, `.lp-card-pad`, `.lp-card-title` in globals.css. Backoffice panels use `border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]` and `lp-motion-card` for hover/transition.
- **Buttons:** `.lp-motion-btn` for interactive buttons; primary action only may use hot-pink focus/hover per AGENTS.md F6.

## 2. Toggle switches (standardized)

- **Track:** `lp-motion-switch` on the track element (consistent 120ms + ease; reduced-motion respected).
- **Thumb:** `lp-motion-switch-thumb` on the thumb (transform transition).
- **Sizes in use:** Track `h-7 w-12` (28×48px) or `h-6 w-11` (24×44px) where space is tight; thumb `h-5 w-5` (20px). Touch targets: full control ≥ 44px where possible (AGENTS S1.1).

## 3. Backoffice / editor cohesion

- Backoffice content editor, SEO panel, block inspector, media picker, and main shell use the same tokens (`--lp-border`, `--lp-card`, `--lp-text`, `--lp-muted`, `--lp-ring`) and motion classes.
- Modals and panels: `lp-motion-card`, `rounded-xl`, `border border-[rgb(var(--lp-border))]`, `bg-white` or `bg-[rgb(var(--lp-card))]`.
- Toggles: all use `lp-motion-switch` and `lp-motion-switch-thumb` so motion language is consistent and accessibility (reduced-motion) is honored.
- Loader/spinner icons: use `lp-icon-sm` (e.g. in MediaPickerModal, ContentSaveBar) for consistent icon sizing.

## 4. What was not changed

- No branding or color rewrite; hot-pink and gold rules unchanged.
- No removal of existing primitives; only additions (e.g. `--lp-card`, `.lp-motion-switch`) and standardization where inconsistency was verified.
- No new heavy animations or layout shifts; motion is limited to transitions already in use, with a single duration/ease and reduced-motion support.

## 5. Success criteria (Phase 12)

- **Consistent primitives:** Tokens, motion, and icon sizes documented and used; `--lp-card` defined; motion classes applied to toggles.
- **Consistent icon sizing:** `.lp-icon-sm` used for small icons (e.g. loaders) instead of ad-hoc sizes.
- **Consistent motion language:** Toggle switches use `lp-motion-switch` / `lp-motion-switch-thumb`; backoffice cards/buttons already use `lp-motion-btn` / `lp-motion-card` where appropriate.
- **Backoffice no longer feels RC/unfinished:** Same token set, motion, and card/button treatments across editor, SEO, block inspector, and shell; toggles feel consistent and polished.
