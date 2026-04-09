# Phase 2 — Design system audit (repo-grounded)

**Scope:** Backoffice, CMS editor, and shared primitives that must feel **premium, calm, and consistent** (Avensia/Umbraco-grade *discipline*, not a rebrand of public marketing unless explicitly scheduled).

## 1. Canonical sources (verified)

| Layer | Location | Role |
|-------|----------|------|
| CSS variables | `app/globals.css` (`:root`, `[data-resolved-theme="dark"]`) | `--lp-bg`, `--lp-surface*`, `--lp-text`, `--lp-muted`, `--lp-border`, `--lp-card`, radius, shadows, `--lp-ease`, hot pink accent hooks |
| Motion | `lib/ui/motion.css` + `lib/ui/motionTokens.ts` (if present) | Durations, `.lp-motion-btn`, `.lp-motion-card`, `.lp-motion-overlay`, switches; `prefers-reduced-motion` |
| Icons | `lib/ui/design.css`, `lib/design/globals.ts` | `.lp-icon-sm` / `md` / `lg` |
| Documentation | `lib/design/README.md`, `docs/VISUAL_SYSTEM.md` | Intended usage; Phase 12 notes on cards, toggles, cohesion |

## 2. Typography

- **Headings:** AGENTS.md **S6** — Inter for enterprise headings; decorative display fonts forbidden for headings.
- **Implementation:** Mix of Tailwind (`font-heading`, `font-body`) and CSS vars; audit needed for **stray font families** in backoffice (grep `font-family`, Google font imports outside layout).

## 3. Color & accent

- **Warm cream / white base** — tokens in `:root`.
- **Hot pink (`--lp-hotpink` / `--lp-neon-pink`):** AGENTS.md **F6** — single primary action accent; no large pink backgrounds.
- **Gold (`--lp-gold*`):** secondary emphasis; documented in `VISUAL_SYSTEM.md`.

## 4. Spacing, radius, shadows

- Radius: `--lp-radius-card`, `--lp-radius-btn`, `--lp-radius-badge`.
- Shadows: `--lp-shadow-card`, `--lp-shadow-soft`, `--lp-shadow-sm`, `--lp-shadow-md`.
- **Gap:** Some panels use ad-hoc Tailwind (`rounded-xl`, arbitrary `p-*`) — inventory during refactor plan.

## 5. Components & patterns

- **Buttons:** `.lp-btn`, `.lp-motion-btn` for interactive affordances.
- **Cards:** `.lp-card`, `.lp-card--elevated`, elevated surfaces in backoffice.
- **Navigation:** Canonical header primitives under `components/nav/` / `src/components/nav/` (AGENTS.md H8).
- **Backoffice content:** Large surface area in `app/(backoffice)/backoffice/content/_components/**` — highest variance risk.

## 6. CMS / editor-specific

- **Editor chrome:** `ContentWorkspace*` shells, `EditorChrome`, rails, modals — mix of inline styles and `rgb(var(--lp-*))`.
- **AI panels:** Multiple `Editor*Ai*.tsx` files — visual weight and hierarchy must be unified in Phase 2 (see `AI_CMS_CONSOLIDATION.md`).

## 7. Gaps (to be addressed in Phase 2 plans)

| Gap | Evidence | Direction |
|-----|----------|-----------|
| No single “design tree” UI | `lib/design/README.md` states no site-wide theme config | Optional: CMS design tab ties to existing tokens only |
| `ContentTree` still uses mock roots | `ContentTree.tsx` references `getMockRoots` | **CONTENT_TREE_IMPLEMENTATION_PLAN** (stream B) |
| Icon/size drift | `VISUAL_SYSTEM.md` warns against ad-hoc icon sizes | Enforce `.lp-icon-*` in touched files |

## 8. Out of scope for this audit doc

- Public homepage full redesign (explicitly excluded per Phase 2 instructions unless a sub-phase is opened).
- Changing AGENTS.md color law — **do not** override without owner approval.

## Next doc

See `CMS_VISUAL_REFACTOR_PLAN.md` (to be created in a later Phase 2 deliverable batch) for concrete UI refactor steps; this file is the **audit snapshot**.
