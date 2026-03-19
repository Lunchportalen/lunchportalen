# Icon system (single source)

**Primary family:** [lucide-react](https://lucide.dev/)

**Single source:** `lib/icons.tsx` — re-exports Lucide icons with canonical names (`IconContent`, `IconCheck`, etc.); consumed only by `lib/iconRegistry.tsx`. Backoffice `_shell/icons.tsx` re-exports only the semantic `Icon` component and types (no raw icon components).

**Rules:**
- No icon family mixing in app code.
- No legacy icon packs or ad-hoc inline SVGs for UI icons.
- New icons: add to `lib/icons.tsx` (re-export from `lucide-react` with `Icon*` name).

**Semantic registry:** `lib/iconRegistry.tsx` — select icons by meaning instead of by component name. Use `getIcon(key)` or `iconRegistry[key]` with a `SemanticIconKey`: `add`, `edit`, `delete`, `search`, `settings`, `menu`, `company`, `location`, `employee`, `kitchen`, `driver`, `order`, `invoice`, `media`, `seo`, `ai`, `warning`, `success`, `info`, `close`, `content`, `logout`. Prefer the registry when the choice is semantic (e.g. "show the add icon here") so the mapping is centralized.

**Sizes:** Standard scale is `xs` (12px), `sm` (16px), `md` (20px), `lg` (24px). Use the `Icon` component’s `size` prop; classes live in `lib/ui/design.css` (`.lp-icon-xs` … `.lp-icon-lg`) and `lib/design/globals.ts` (`iconSizes`). Do not use arbitrary Tailwind dimensions for icons; use the size prop only.

**Adoption (verified):** UI icons use the semantic registry via `components/ui/Icon.tsx`: `<Icon name="search" size="sm" />`. Navigation, buttons, dropdowns, tables, and editor actions all use `Icon` with `SemanticIconKey`. No `app/` or `components/` code imports from `lucide-react` or raw `Icon*` from `@/lib/icons`; icon system is consistent and controlled (100%).

**Accessibility:** (1) Decorative icons use default `aria-hidden="true"` (Icon component). (2) Icon-only buttons and links must have an accessible name: `aria-label` (or visible text). (3) Icons do not replace necessary text; use them to reinforce, not as the only label.

**Note:** Sanity Studio (`studio/`) may use `@sanity/icons`; that is a separate app boundary. The main Lunchportalen app uses only lucide-react via `lib/icons`.
