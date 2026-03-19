# ICON DISCOVERY REPORT

**Scope:** `components/`, `components/ui/`, `components/layout/`, `app/(public)/`, `app/(backoffice)/`  
**Goal:** Verified map of all icon usage before normalizing the system.  
**Date:** 2025-03-14

---

## 1. ICON SOURCES

### 1.1 Canonical backoffice icon set (single source)

| Location | Description |
|----------|-------------|
| `app/(backoffice)/backoffice/_shell/icons.tsx` | **Primary icon source.** 21 React components, inline SVG, 24×24 viewBox, `stroke="currentColor"` / `strokeWidth="2"`. All accept `SVGProps<SVGSVGElement>` (e.g. `className`). |

**Exported icons:**

| Icon | Semantic use |
|------|----------------|
| IconContent | Content / document |
| IconMedia | Media / image |
| IconTemplate | Templates / grid |
| IconUsers | Users (multiple) |
| IconMember | Member (single user) |
| IconForm | Form / document |
| IconTranslation | Language / globe |
| IconSettings | Settings / gear |
| IconReleases | Releases / clock |
| IconRecycle | Recycle bin / trash |
| IconHome | Home |
| IconFolder | Folder / document (tree) |
| IconChevronRight | Expand / navigate |
| IconChevronUp | Move up / collapse |
| IconChevronDown | Move down / expand |
| IconCheck | Success / OK |
| IconWarning | Warning / alert |
| IconLoader | Loading / spinner |
| IconSparkles | AI |
| IconX | Close / dismiss |
| IconPlus | Add / empty state |
| IconImage | Image / media (duplicate of IconMedia shape) |

**Design tokens:** `lib/ui/design.css` — `.lp-icon-sm` (16px), `.lp-icon-md` (20px), `.lp-icon-lg` (24px). Aligned with `lib/design/globals.ts` `iconSizes`.

---

### 1.2 Inline SVG (no shared component)

| File | What | ViewBox / size | Notes |
|------|------|----------------|--------|
| `components/ui/select.tsx` | Chevron down (caret) | 20×20 | Heroicons-style path, `h-4 w-4` |
| `components/ui/checkbox.tsx` | Check mark | 20×20 | White stroke, `h-5 w-5`, peer-checked |
| `components/superadmin/StatusDropdown.tsx` | Chevron down | 20×20 | Same path as select; `h-4 w-4`, `rotate-180` when open |
| `components/superadmin/SuperadminMobileMenu.tsx` | Hamburger (3 lines) | 24×24, 18×18 | Local `HamburgerIcon()` |
| `app/(public)/hvordan/page.tsx` | IconCheck, IconClock, IconShield | 24×24, 18×18 | Local components, stroke 2.2 |
| `app/(backoffice)/.../ContentWorkspace.tsx` | Home, Lock, Globe, Design (crop), Recycle | 24×24, 18×18 or 14×14 | Inline in nav sidebar (no import from `icons.tsx`) |
| `app/(backoffice)/.../BlockInspectorShell.tsx` | Document, Settings (gear) | 24×24, `h-3.5 w-3.5` | Inline in banner panel tabs |

---

### 1.3 CSS-only “icons”

| Class | File | Description |
|-------|------|-------------|
| `.lp-faq-icon` / `.lp-faqPlus` | `app/globals.css` | Plus/cross toggle (::before/::after), 18×18 box |
| `.lp-related-cta-icon` | `app/globals.css` | Hook for related CTA (minimal styling) |
| `.lp-motion-icon` | `lib/ui/motion.css` | Transform only (e.g. chevron rotate); no shape |

---

### 1.4 Emoji / Unicode (legacy)

| Location | Usage |
|----------|--------|
| `app/driver/DriverClient.tsx` | IconBtn children: ⚙️ (Verktøy), ↻ (Oppdater), ⎋ (Logg ut) |
| `app/(backoffice)/.../ContentWorkspace.tsx` | “▼” / “▶” for tree expand, “+”, “⊞”, “–” in various UI |
| `app/(backoffice)/.../BlockPickerOverlay.tsx` | `def.iconKey ?? "block"` rendered as text (block type as placeholder) |

---

### 1.5 External icon libraries

| Library | In repo | Used in scoped dirs |
|---------|---------|----------------------|
| lucide-react | No | No |
| @heroicons/react | No | No (inline paths are Heroicons-like) |
| react-icons | No | No |
| @radix-ui/icons | No | No |
| @sanity/icons | Yes (root + studio) | **No** in `components/` or `app/(backoffice)/` or `app/(public)/`; only in `studio/deskStructure.ts` (CalendarIcon) |

**Conclusion:** Scoped areas use **no** third-party icon libs; backoffice uses a single local SVG component set + scattered inline SVGs and emoji.

---

## 2. DUPLICATED SEMANTICS

| Meaning | Canonical | Duplicates |
|---------|-----------|------------|
| **Check / success** | `icons.tsx` IconCheck | `app/(public)/hvordan/page.tsx` local `IconCheck()` (same path, 18×18, stroke 2.2) |
| **Chevron down** | `icons.tsx` IconChevronDown | `components/ui/select.tsx`, `components/superadmin/StatusDropdown.tsx` (Heroicons path, 20×20) |
| **Home** | `icons.tsx` IconHome | `ContentWorkspace.tsx` inline home SVG (18×18) |
| **Globe / translation** | `icons.tsx` IconTranslation | `ContentWorkspace.tsx` inline globe SVG (18×18) |
| **Recycle / trash** | `icons.tsx` IconRecycle | `ContentWorkspace.tsx` inline recycle SVG (18×18) |
| **Close / X** | `icons.tsx` IconX | — (no duplicate; backoffice uses IconX) |
| **Document / content** | `icons.tsx` IconContent | `BlockInspectorShell.tsx` inline document SVG (h-3.5) |
| **Settings** | `icons.tsx` IconSettings | `BlockInspectorShell.tsx` inline settings SVG (h-3.5) |
| **Image / media** | IconMedia ≈ IconImage | Same path in `icons.tsx` (IconMedia and IconImage); IconImage is redundant. |

**Clock** and **Shield** exist only as local components on `hvordan/page.tsx`; no backoffice equivalent in `icons.tsx`.

---

## 3. INCONSISTENT USAGE

### 3.1 Size patterns

| Pattern | Where | Intended |
|---------|--------|----------|
| `.lp-icon-sm` (16px) | Backoffice buttons, tree, modals, save bar, AI tools | Inline actions |
| `.lp-icon-md` (20px) | ModulesRail only | Nav/rail |
| `h-4 w-4` (16px) | experiments/page (IconPlus), experiments/[id] (IconCheck), ContentAiTools (IconWarning), StatusDropdown, select caret, FormBlock | Mixed; same as lp-icon-sm |
| `h-3.5 w-3.5` (14px) | BlockInspectorShell tabs | Smaller than design tokens |
| `h-10 w-10` / `h-12 w-12` | Empty states (IconPlus, IconMedia), ModulesRail button wrapper | Large empty-state icons |
| `width="18" height="18"` | hvordan IconCheck/Clock/Shield, ContentWorkspace inline SVGs, SuperadminMobileMenu | 18px not in design.css |
| `width="14" height="14"` | ContentWorkspace lock icon | Ad hoc |
| `h-5 w-5` | checkbox check | Form control |
| `h-6 w-6` | ContentWorkspace sidebar icon wrapper (with 18px SVG inside) | Wrapper vs inner size mismatch |

**Summary:** Backoffice standard is `lp-icon-sm` / `lp-icon-md` / `lp-icon-lg`, but many places use raw Tailwind (`h-4 w-4`, `h-3.5`, etc.) or inline `width`/`height`. 18px and 14px have no token in `lib/ui/design.css`.

### 3.2 Naming and placement

- Backoffice: `Icon*` from `_shell/icons.tsx`, used with `className="lp-icon-sm"` or `lp-icon-md`.
- Public hvordan: local `IconCheck`, `IconClock`, `IconShield` (same names, different implementation).
- ContentWorkspace: does not import from `icons.tsx` for sidebar (Home, Global, Design, Recycle, Lock); uses inline SVGs.
- BlockInspectorShell: inline SVGs for Content/Settings tabs instead of IconContent/IconSettings.

---

## 4. OUTDATED / LEGACY ICONS

| Item | Location | Issue |
|------|----------|--------|
| Driver action icons | `app/driver/DriverClient.tsx` | Unicode/emoji (⚙️, ↻, ⎋) instead of SVG; not accessible or size-consistent. |
| FAQ toggle | `app/globals.css` | CSS-only plus/cross; 18×18, no SVG. Used on lunsj-levering-oslo, lunsjordning-trondheim, alternativ-til-kantine, hvordan. |
| Tree expand | `ContentWorkspace.tsx` | “▼” / “▶” Unicode instead of IconChevronDown/IconChevronRight. |
| Block type placeholders | BlockPickerOverlay, BlockCanvas | `iconKey ?? "block"` renders text; no real icon set for block types. |
| Heroicons-style inline SVGs | select, StatusDropdown, checkbox | 20×20 viewBox, fill or stroke; could be replaced by backoffice chevron/check set for consistency. |

---

## 5. FILES REFERENCE (by category)

### Backoffice shell (canonical)

- `app/(backoffice)/backoffice/_shell/icons.tsx` — all 21 Icon* components
- `app/(backoffice)/backoffice/_shell/TopBar.tsx` — uses Icon* from icons, `lp-icon-sm`
- `app/(backoffice)/backoffice/_shell/ModulesRail.tsx` — uses Icon* from icons, `lp-icon-md`

### Backoffice content (uses icons.tsx + inline)

- `app/(backoffice)/backoffice/content/_tree/TreeNodeRow.tsx` — IconHome, IconFolder, IconRecycle, IconChevronRight
- `app/(backoffice)/backoffice/content/_components/BlockCanvas.tsx` — IconPlus, IconChevronUp/Down, IconRecycle
- `app/(backoffice)/backoffice/content/_components/BlockInspectorShell.tsx` — IconPlus; inline SVGs for Content/Settings tabs
- `app/(backoffice)/backoffice/content/_components/BlockAddModal.tsx`, BlockEditModal.tsx, BlockPickerOverlay.tsx — IconX
- `app/(backoffice)/backoffice/content/_components/ContentSaveBar.tsx` — IconWarning, IconLoader
- `app/(backoffice)/backoffice/content/_components/ContentAiTools.tsx` — IconSparkles, IconCheck, IconWarning
- `app/(backoffice)/backoffice/content/_components/MediaPickerModal.tsx` — IconX, IconLoader, IconMedia, IconWarning
- `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` — inline Home, Lock, Globe, Design, Recycle; Unicode ▼/▶/+

### Backoffice experiments

- `app/(backoffice)/backoffice/experiments/page.tsx` — IconPlus, IconLoader (`h-4 w-4`, `lp-icon-sm`)
- `app/(backoffice)/backoffice/experiments/[id]/page.tsx` — IconLoader, IconCheck

### Components

- `components/ui/select.tsx` — inline chevron SVG
- `components/ui/checkbox.tsx` — inline check SVG
- `components/superadmin/StatusDropdown.tsx` — inline chevron SVG
- `components/superadmin/SuperadminMobileMenu.tsx` — HamburgerIcon inline SVG

### Public

- `app/(public)/hvordan/page.tsx` — IconCheck, IconClock, IconShield (local)

### Driver

- `app/driver/DriverClient.tsx` — IconBtn with emoji children

### Design tokens

- `lib/ui/design.css` — .lp-icon-sm, .lp-icon-md, .lp-icon-lg
- `lib/design/globals.ts` — iconSizes
- `app/globals.css` — .lp-faq-icon, .lp-related-cta-icon, .lp-motion-icon

---

## 6. RECOMMENDATIONS (for normalization)

1. **Single source:** Treat `app/(backoffice)/backoffice/_shell/icons.tsx` as canonical for all SVG icons; add IconClock, IconShield, IconChevronDown (if not already used for dropdowns), and a single Hamburger if needed.
2. **Replace duplicates:** Use IconCheck, IconHome, IconTranslation, IconRecycle, IconContent, IconSettings from `icons.tsx` in ContentWorkspace and BlockInspectorShell instead of inline SVGs.
3. **Sizes:** Use only `.lp-icon-sm`, `.lp-icon-md`, `.lp-icon-lg` (or add `.lp-icon-xs` for 14px) and remove ad hoc `h-3.5`, `width="18"`, `width="14"` where possible.
4. **Public page:** Replace local IconCheck/Clock/Shield on `hvordan/page.tsx` with shared components (e.g. from a shared `components/icons/` or re-export from backoffice shell if acceptable).
5. **Select/StatusDropdown/Checkbox:** Replace Heroicons-style inline SVGs with IconChevronDown and a shared check icon from the canonical set for consistency.
6. **Driver:** Replace emoji (⚙️, ↻, ⎋) with SVG icons from the canonical set (e.g. IconSettings, IconLoader, IconX or a dedicated “logout” icon).
7. **FAQ:** Consider replacing CSS .lp-faq-icon with a small SVG plus/chevron from the icon set for consistency and a11y.
8. **Block picker:** Define a small set of block-type icons (or map block types to IconContent/IconImage/etc.) instead of `iconKey ?? "block"` text.

---

**Report status:** Verified by scan of `components/`, `components/ui/`, `components/layout/`, `app/(public)/`, `app/(backoffice)/`. No lucide-react, heroicons, or react-icons in these trees; @sanity/icons only in studio.
