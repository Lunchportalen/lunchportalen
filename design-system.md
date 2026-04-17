# Lunchportalen design system

Single product, one visual language. **Prefer shared primitives** over ad-hoc Tailwind on interactive UI.

**Implementation paths**

| Layer | Import | Use for |
|-------|--------|---------|
| **Tokens** | `@/lib/design/tokens` | Spacing, radius, shadow, motion strings in composed classNames |
| **DS primitives** | `@/components/ui/ds` | `DsButton`, `DsCard`, `DsToolbar`, `DsBadge`, `DsEmptyState`, `DsIcon` |
| **CMS** | `@/components/cms` | Block editor chrome: `BlockCard`, `BlockToolbar`, `BlockPreview` |
| **AI** | `@/components/ai` | `AiButton`, `AiPanel`, `AiBadge` |
| **Layout** | `@/components/layout` | `PageContainer`, `Section` |
| **Legacy UI** | `@/components/ui/button`, `card` | Existing shadcn/LP `Button`, `Card` — **do not remove**; migrate new work to DS where listed below |

---

## When to use `DsButton`

Use **`DsButton`** from `@/components/ui/ds` when:

- Building **CMS backoffice** editor flows, empty states, and dashed “add block” actions.
- You need **`primary`** (pink → purple gradient), **`secondary`** (dashed LP border + white surface), or **`ghost`** (minimal surface).

Do **not** duplicate gradient / dashed-primary patterns with raw `className` on `<button>`.

Use **`@/components/ui/button`** (`Button` with `variant="primary" | "gradient" | …` and `lp-btn`) when:

- The surface already uses the **global LP button** system (auth, marketing, admin tables).
- You need **`asChild`**, **`destructive`**, **`icon` size**, or existing variants not yet mirrored in DS.

---

## When to use `DsCard`

Use **`DsCard`** when:

- You need a **reusable bordered surface** with **`interactive`** (hover lift + border accent) or **`selected`** (ring + pink tint).

Use **`Card`** from `@/components/ui/card` when:

- You rely on **`lp-card` / `lp-motion-card`** or **`CardHeader` / `CardTitle` / `CardContent`** composition.

Use **`BlockCard`** when:

- Wrapping a **CMS block row** (selection, pulse, preview-hover). Do not reimplement that shell with raw divs.

---

## AI affordances

- **Gradient + sparkle + “generate with AI”** → **`AiButton`** (`@/components/ai`).
- **AI tool strip container** → **`AiPanel`**.
- **Small “AI” label** → **`AiBadge`**.

Do not reintroduce `bg-gradient-to-r from-pink-500 to-purple-600` on random `<button>` elements.

---

## Layout

- **Centered max-width columns** → **`PageContainer`** (`narrow` \| `content` \| `wide`).
- **Vertical section rhythm from tokens** → **`Section`** with `padding` from design tokens.

---

## Raw Tailwind: allowed vs discouraged

### Allowed (not “design system violations”)

- **Layout**: `flex`, `grid`, `gap-*`, `min-w-0`, responsive breakpoints.
- **Positioning**: `absolute`, `sticky`, `inset-*` for overlays and toolbars **when** no DS wrapper exists yet.
- **Typography**: one-off `text-sm`, `truncate`, line-clamp in dense tools.
- **Domain semantics**: kitchen/driver **status colours** (e.g. amber) where meaning is operational.

### Discouraged (prefer DS / tokens)

- **New** primary/secondary **CTAs** built only with long `className` strings on `<button>` — use `DsButton`, `AiButton`, or `Button`.
- **New** “card” shells duplicating `rounded-xl border shadow-sm` — use `DsCard` or `Card`.
- **Copy-pasted** pink gradient buttons — use **`AiButton`** or **`DsButton` `primary`**.

### “No raw styles” (enforcement intent)

For **new and touched** UI in `app/**` and `components/**`:

1. **Interactive controls** → component library first (`DsButton`, `Button`, `AiButton`).
2. **Surfaces** → `DsCard`, `Card`, `BlockCard`, `AiPanel`.
3. **Repeated motion** → `motion` from `@/lib/design/tokens` instead of one-off `duration-200` strings where you are standardizing a strip.

Full repo migration is **incremental**; follow this doc when editing a file.

---

## File map

```
lib/design/tokens.ts          # tokens
lib/design/index.ts           # re-export
components/ui/ds/*            # DsButton, DsCard, DsToolbar, DsBadge, DsEmptyState, DsIcon
components/cms/*              # BlockCard, BlockToolbar, BlockPreview
components/ai/*               # AiButton, AiPanel, AiBadge
components/layout/*           # PageContainer, Section
```

---

## Cursor

Project rule: `.cursor/rules/design-system.mdc` — applied for TSX/JSX work.
