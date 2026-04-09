# Phase 2A — Design token map

## Canonical (single source of truth)

| Layer | Source | Usage |
|-------|--------|--------|
| **CSS variables** | `app/globals.css` `:root` and `html[data-resolved-theme="dark"]` | `--lp-bg`, `--lp-surface`, `--lp-surface-alt`, `--lp-card`, `--lp-text`, `--lp-muted`, `--lp-border`, `--lp-hotpink`, **`--lp-chrome-bg`**, **`--lp-ink-plum`**, shadows, radius CSS vars |
| **Tailwind fragments** | `lib/design/tokens.ts` | `radius`, `shadow`, `motion`, `focusRing`, `spacing` — used by DS and editor |
| **Shell class strings** | `lib/design/cmsShell.ts` | `cmsWorkspaceMainSurfaceClass`, `cmsSectionTreeAsideClass` |
| **Motion / icon sizing** | `docs/VISUAL_SYSTEM.md`, `lib/ui/motion.css`, `lib/ui/design.css` | `.lp-motion-*`, `.lp-icon-*` |

## Fragmented / legacy (do not duplicate; migrate opportunistically)

| Area | Notes |
|------|--------|
| `lib/design/tokens.ts` `colors` object | Uses `pink-500`, `slate-200`, `white` — overlaps conceptually with `--lp-*`; kept for JIT-safe fragments, not a second theme |
| Inline `pink-*` / `slate-*` in CMS components | Historical; prefer `--lp-border`, `--lp-card`, `--lp-text` for new edits |
| `lib/ui/tokens.ts` `enterpriseSurface` | Enterprise/superadmin aliases; re-exports `lib/design/tokens` |

## DS components ↔ tokens

| Component | Primary tokens |
|-----------|----------------|
| `DsButton` | `focusRing`, `radius`, `shadow`, `motion`, `--lp-text`, `--lp-border` |
| `DsCard` | `--lp-border`, `radius`, `shadow`, `motion` |
| `DsBadge` | `--lp-border`, `--lp-card`, `--lp-muted`, `radius.sm` |
| `DsEmptyState` | `--lp-border`, `--lp-card`, `--lp-text`, `--lp-muted`, `motion`, `shadow` |
| `DsToolbar` | `--lp-border`, `radius`, `shadow`, `motion` |

## Reference

- Authoritative narrative: `docs/VISUAL_SYSTEM.md`
- AGENTS.md F6/F7: hot pink discipline, layout max width for admin
