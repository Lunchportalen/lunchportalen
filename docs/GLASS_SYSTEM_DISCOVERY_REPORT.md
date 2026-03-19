# Glass system discovery report

**Scope:** Premium glass / blur / translucent UI usage across the repository.  
**Rules:** Read-only discovery; no redesign; no new visual concepts; verified inconsistencies only.  
**Scanned:** `components/`, `components/ui/`, `components/layout/`, `components/blocks/`, `styles/`, `tailwind.config.*`, `app/(public)/`, `app/(backoffice)/` (plus cross-repo grep for glass/blur/translucent).

---

## 1. Glass primitives found

### 1.1 CSS classes (central definitions)

| Source | Class | Blur | Background | Use |
|--------|--------|------|-------------|-----|
| `lib/ui/motion.css` | `.lp-glass-overlay` | 4px | `rgba(0,0,0,0.5)` | Modal/overlay backdrops |
| `lib/ui/motion.css` | `.lp-glass-panel` | 8px | `rgba(255,255,255,0.95)` | Modal/dialog content panel |
| `lib/ui/motion.css` | `.lp-glass-bar` | 4px | `rgba(255,255,255,0.95)` | Sticky bars (save bar, side panels) |
| `app/globals.css` | `.lp-topbar` | 4px | `rgba(var(--lp-surface-rgb), 0.92)` | Header (with dark variant 0.82) |
| `app/globals.css` | `.lp-modalOverlay` | 3px | `rgba(0,0,0,0.55)` | Legacy modal overlay |
| `app/globals.css` | `.lp-panelCard`, `.lp-panel` | 10px | `rgba(255,255,255,0.1)` | Hero glass panel (public) |
| `app/globals.css` | `.lp-heroPanel .lp-panelCard` | 14px | `rgba(18,18,18,0.72)` | Hero panel contrast override |
| `app/globals.css` | `.lp-altkantine .lp-heroPanel .lp-panelCard` | 10px | `rgba(18,18,18,0.62)` | Alt-kantine hero override |
| (hero badge) `app/globals.css` | — | 6px | `rgba(255,255,255,0.12)` | Hero stripe/badge |

**Note:** `tailwind.config.cjs` has `theme: { extend: {} }` — no custom blur/glass tokens. All blur/opacity are either Tailwind defaults or raw CSS.

---

## 2. Inline / Tailwind glass usage (no shared token)

### 2.1 Backdrop blur levels in use

| Blur | Where | Notes |
|------|--------|--------|
| `backdrop-blur-[2px]` | `components/ui/dialog.tsx` overlay | Only arbitrary value; differs from all primitives |
| `backdrop-blur` (Tailwind default 8px) | Many sections, cards, headers | See duplicated patterns below |
| `backdrop-blur-sm` (4px) | `ModulesRail.tsx`, `companies-client.tsx` overlay | Matches motion.css 4px |
| `backdrop-blur-md` (12px) | `TopBar.tsx` (backoffice) | Dark shell only |
| `backdrop-blur-xl` (24px) | `DriverClient.tsx` (sticky bar, cards) | Driver-only; strongest blur |

### 2.2 Translucent backgrounds (opacity) in use

- **White:** `/95`, `/90`, `/80`, `/75`, `/70`, `/60`, `/40`  
- **Slate (dark):** `slate-900/85`, `slate-800/90`  
- **LP tokens:** `bg-[rgb(var(--lp-bg))]/80`, `/90`, `bg-[rgba(var(--lp-surface),0.85)]`  
- **Black (overlays):** `/35`, `/25`, `/50`  

No single opacity scale or token set; mix of Tailwind fraction and CSS variable + alpha.

---

## 3. Duplicated patterns

### 3.1 Admin section card (exact same long string, 10+ files)

```text
rounded-3xl bg-white/80 p-6 ring-1 ring-black/5 shadow-[0_12px_44px_-34px_rgba(0,0,0,.40)] backdrop-blur
```

**Files:**  
`AdminInsightsClient.tsx`, `admin/history/page.tsx`, `admin/invite/InviteClient.tsx` (×4), `admin/locations/page.tsx`, `BlockedState.tsx`, `AgreementBlock.tsx` (×2).

**Variant (no shadow):**  
`AgreementBlock.tsx` same but without `shadow-[...]`.

### 3.2 Legal/static content card (exact same string, 3 pages)

```text
rounded-2xl border bg-white/90 p-4 shadow-sm backdrop-blur
```
(p-5 variant also: `p-5`)

**Files:**  
`kontakt/KontaktClient.tsx` (×4), `personvern/page.tsx` (×3), `vilkar/page.tsx` (×3).

### 3.3 Superadmin layout card

```text
rounded-3xl bg-white/70 p-4 ring-1 ring-[rgb(var(--lp-border))] shadow-sm backdrop-blur sm:p-6
```

**File:**  
`app/superadmin/layout.tsx` (wrapper).

Similar but not identical:  
`superadmin/audit/page.tsx` uses `p-6` and same ring/shadow/backdrop.

### 3.4 Audit/superadmin sticky toolbar

```text
rounded-2xl border border-[rgba(var(--lp-border),0.9)] bg-[rgba(var(--lp-surface),0.85)] p-3 backdrop-blur
```

**Files:**  
`AuditCompanyPanel.tsx`, `audit-detail-client.tsx`, `audit-client.tsx` (same pattern; AuditCompanyPanel has `rounded-xl ... px-3 py-2` and sticky toolbar variant).

### 3.5 Toast / portal toast

Same class string in two places:

```text
rounded-2xl border border-[rgb(var(--lp-border))] bg-white/95 p-3 shadow-[var(--lp-shadow-soft)] backdrop-blur
```

**Files:**  
`lib/toast/ToastProvider.tsx`, `components/providers/PortalProviders.tsx`.

---

## 4. Inconsistent blur levels

| Context | Blur in use | Primitives nearby |
|--------|-------------|-------------------|
| Modal overlay (backoffice) | 4px (lp-glass-overlay) | — |
| Modal overlay (dialog.tsx) | 2px (inline) | Differs from lp-glass-overlay (4px) |
| Legacy modal (DangerConfirmModal, CompaniesClient) | 3px (lp-modalOverlay) | Different from backoffice (4px) |
| Media delete confirm overlay | None (bg-black/50 only) | No blur; not using lp-glass-overlay |
| Topbar (public/admin) | 4px (globals .lp-topbar or inline backdrop-blur) | Some headers use inline backdrop-blur + bg-white/80 or /90 |
| Backoffice TopBar (dark) | 12px (backdrop-blur-md) | Stronger than all other headers |
| Backoffice ModulesRail | 4px (backdrop-blur-sm) | Matches motion 4px |
| Hero panel (default) | 10px base, 14px override | Two levels in globals |
| Hero panel (alt-kantine) | 10px | Different from default 14px |
| Driver sticky bar & cards | 24px (backdrop-blur-xl) | Only place using xl |
| Cards/sections (admin, superadmin) | 8px (Tailwind default backdrop-blur) | No shared primitive |

**Summary:** Blur values present: **2px, 3px, 4px, 6px, 8px, 10px, 12px, 14px, 24px** — nine different levels with no single scale or token.

---

## 5. Inconsistent opacity tokens

- **Header backgrounds:**  
  `bg-white/80`, `bg-white/90`, `supports-[backdrop-filter]:bg-white/75`, `bg-[rgb(var(--lp-bg))]/80`, `bg-[rgb(var(--lp-bg))]/90`, `bg-slate-900/85`, `bg-slate-800/90`.  
  No single “header glass” token; light vs dark and support fallback handled ad hoc.

- **Card/surface:**  
  `bg-white/60`, `bg-white/70`, `bg-white/80`, `bg-white/95`, `bg-[rgba(var(--lp-surface),0.85)]`.  
  Overlap with motion.css (e.g. .lp-glass-panel 0.95) but no shared token set.

- **Overlay backdrops:**  
  `bg-black/25`, `bg-black/35`, `bg-black/50`, plus motion.css `rgba(0,0,0,0.5)`.  
  Multiple overlay opacities with no single “overlay” token.

---

## 6. Surfaces missing glass polish (or mixed pattern)

- **components/ui/dialog.tsx**  
  Overlay: inline `bg-black/35 backdrop-blur-[2px]` instead of `lp-glass-overlay`.  
  Panel: solid `bg-[color:var(--lp-surface)]` — no glass; differs from backoffice modals that use `lp-glass-panel`.

- **Media delete confirm** (`app/(backoffice)/backoffice/media/page.tsx`)  
  Overlay: `bg-black/50` only; no blur, no `lp-glass-overlay`.  
  Panel: solid `bg-white`; no glass.

- **DangerConfirmModal.tsx**  
  Uses `lp-modalOverlay` (3px blur) instead of `lp-glass-overlay` (4px); different system from backoffice content modals.

- **CompaniesClient.tsx**  
  Same as above: `lp-modalOverlay`.

- **Public/Admin headers**  
  Some use `.lp-topbar` (globals), others use inline `bg-white/80` or `bg-white/90` + `backdrop-blur` and optionally `supports-[backdrop-filter]:bg-white/75`.  
  Not fully normalized to one header glass primitive.

- **ContentSaveBar**  
  Uses `lp-glass-bar` (motion.css) — correct.  
  **ContentAiTools** uses `lp-glass-bar` plus extra border/radius/padding; bar primitive is shared but surrounding layout differs (acceptable if intentional).

- **DriverClient**  
  Uses `backdrop-blur-xl` (24px) and `bg-white/60`, `bg-white/70`, `bg-white/95` — no use of motion.css glass classes; driver-only “heavy” glass.

---

## 7. Summary table

| Category | Finding |
|----------|---------|
| **Glass primitives** | 3 in motion.css (overlay, panel, bar); 4+ in globals (topbar, modal overlay, hero panel variants). No tailwind theme extension for blur/glass. |
| **Duplicated patterns** | 5+ long repeated class strings (admin card, legal card, superadmin layout, audit toolbar, toast). |
| **Blur inconsistency** | 9 different blur values (2, 3, 4, 6, 8, 10, 12, 14, 24px); dialog overlay 2px vs 4px primitive; legacy modal 3px vs 4px; media overlay 0px. |
| **Opacity inconsistency** | No single scale; mix of white/slate/LP/black with fractions and rgba; header and card opacities not tokenized. |
| **Surfaces missing polish** | Dialog overlay/panel not using lp-glass-*; media delete overlay no blur/glass; DangerConfirmModal/CompaniesClient use lp-modalOverlay (different blur); driver uses inline heavy blur only. |

---

## 8. File index (glass-relevant)

- **Primitives:** `lib/ui/motion.css`, `app/globals.css` (lp-topbar, lp-modalOverlay, lp-panel*, lp-heroPanel .lp-panelCard, altkantine override).
- **Backoffice modals (use motion.css glass):** `BlockAddModal.tsx`, `BlockEditModal.tsx`, `BlockPickerOverlay.tsx`, `MediaPickerModal.tsx`.
- **Backoffice shell:** `TopBar.tsx`, `ModulesRail.tsx`, `ContentSaveBar.tsx`, `ContentAiTools.tsx`.
- **Dialog (inline, no lp-glass):** `components/ui/dialog.tsx`.
- **Legacy modal overlay:** `DangerConfirmModal.tsx`, `CompaniesClient.tsx`; media delete: `app/(backoffice)/backoffice/media/page.tsx`.
- **Headers:** `AppHeader.tsx`, `PublicHeader.tsx`, `AdminHeader.tsx`, `components/site/AdminHeader.tsx`, `components/site/PublicHeader.tsx`, `AppChrome.tsx`.
- **Public hero/panel:** `app/(public)/alternativ-til-kantine/page.tsx`, `app/(public)/hvordan/page.tsx`, `app/(public)/lunsjordning/page.tsx`.
- **Admin/superadmin cards:** Multiple under `app/admin/`, `app/superadmin/`, `components/admin/`, `components/superadmin/`.
- **Driver:** `app/driver/DriverClient.tsx`.
- **Toast:** `lib/toast/ToastProvider.tsx`, `components/providers/PortalProviders.tsx`.

---

*End of report. No code or UI changes; discovery only.*
