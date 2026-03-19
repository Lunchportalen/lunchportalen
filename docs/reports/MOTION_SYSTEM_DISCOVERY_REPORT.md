# MOTION SYSTEM DISCOVERY REPORT

**Scope:** Motion layer across UI, blocks, and editor surfaces.  
**Goal:** Map existing motion and identify gaps preventing Motion System maturity ≥100%.  
**Rules:** Read-only discovery; no UI redesign; no decorative motion; small patches only.

---

## 1. SHARED MOTION PRIMITIVES FOUND

### 1.1 `lib/ui/motion.css` (loaded via `app/layout.tsx`)

| Token / Class | Purpose |
|---------------|---------|
| `--lp-duration-fast` | 120ms |
| `--lp-duration-normal` | 200ms |
| `--lp-duration-enter` | 220ms |
| `.lp-motion-btn` | transform, box-shadow, background-color, border-color, color, opacity |
| `.lp-motion-card` | transform, box-shadow, border-color |
| `.lp-motion-overlay` | opacity, transform |
| `.lp-motion-row` | background-color, box-shadow |
| `.lp-motion-switch` / `.lp-motion-switch-thumb` | track/thumb transitions |
| `.lp-motion-icon` | transform only |
| `.lp-glass-overlay` | backdrop (no transition) |
| `.lp-glass-panel` | panel surface (no transition) |
| `.lp-glass-bar` | sticky bar (no transition) |

All `.lp-motion-*` classes are disabled under `@media (prefers-reduced-motion: reduce)`.

### 1.2 `app/globals.css`

| Token / Class | Purpose |
|---------------|---------|
| `--lp-ease` | `cubic-bezier(0.2, 0.8, 0.2, 1)` (defined in `:root` only) |
| `.lp-nav-item` | 120ms transform, box-shadow, background-color |
| `.lp-card` | 0.2s box-shadow, border-color, transform |
| `.lp-btn` | 120ms transform, box-shadow, background-color, color, border-color |
| `.lp-link` | 120ms transform, box-shadow, background-color, border-color, color |
| `.lp-related-card` | 140ms transform, box-shadow, border-color |
| `.lp-section-img` | 0.22s transform, box-shadow |
| `@keyframes lp-hero-fade` | hero rotator (18s infinite) |
| `@keyframes lp-shine` | shine sweep (0.95s) |

Reduced-motion in globals: `.lp-hero-frame`, `.lp-btn`, `.lp-card`, `.lp-nav-item` only.

### 1.3 `lib/ui/motionTokens.ts`

- **motionTokens:** `durationFast` (120ms), `durationNormal` (200ms), `durationEnter` (220ms), `ease`.
- **motionClasses:** `button`, `card`, `overlay`, `row` (string names for `.lp-motion-*`).

**Usage:** Not imported anywhere in the codebase. Components use string literals (e.g. `"lp-motion-btn"`) instead of `motionClasses.button`.

### 1.4 Tailwind

- `tailwind.config.cjs`: no `theme.extend` for duration or transition; no motion utilities.
- Inline usage: `duration-150`, `duration-200`, `[transition-timing-function:var(--lp-ease)]` in `components/ui/*` (input, select, dialog, switch, checkbox, tabs, toast, button, table, textarea).

---

## 2. DUPLICATED MOTION PATTERNS

| Pattern | Location A | Location B | Note |
|--------|------------|-------------|------|
| Button transition | `.lp-btn` (globals, 120ms) | `.lp-motion-btn` (motion.css, 120ms) | Same intent; two class families. Backoffice uses `lp-motion-btn`, public/admin use `lp-btn`. |
| Card transition | `.lp-card` (globals, 0.2s) | `.lp-motion-card` (motion.css, 200ms) | Many components use both: `"lp-card lp-motion-card"` → duplicate transition definitions. |
| Form/UI control | components/ui (Tailwind duration-200 + var(--lp-ease)) | motion.css primitives | Switch/input/dialog don’t use `.lp-motion-*`; they re-specify duration and ease. |
| “Bare” transition | Public pages (vilkar, kontakt, personvern, onboarding, admin pills) | — | `"transition"` or `"transition hover:..."` with no duration or easing. |

**Files with duplicated card usage (lp-card + lp-motion-card):**  
`components/HowItWorks.tsx`, `components/Control.tsx`, `components/Pricing.tsx`, `components/Solution.tsx`, `components/Sustainability.tsx`, `components/Problem.tsx`.

**Files using only `.lp-card` (no motion class):**  
`app/lunsjordning-trondheim/page.tsx`, `app/superadmin/audit/[id]/page.tsx`, `app/(app)/home/page.tsx`, `app/(public)/page.tsx`, `app/hva-er-lunsjordning/page.tsx`, `components/layout/PageSection.tsx`.

---

## 3. INCONSISTENT TRANSITION USAGE

### 3.1 Durations in use

| Value | Where |
|-------|--------|
| 120ms | .lp-btn, .lp-nav-item, .lp-link, .lp-motion-btn |
| 150ms | dialog trigger/close (components/ui/dialog.tsx), button.tsx, checkbox opacity |
| 200ms | .lp-motion-card, .lp-motion-overlay (via token), components/ui (duration-200) |
| 140ms | .lp-related-card |
| 220ms | .lp-motion-overlay (--lp-duration-enter) |
| 0.2s | .lp-card |
| 0.22s | .lp-section-img |

Mixed units (ms vs s) and multiple “normal” durations (150 vs 200) with no single canonical value.

### 3.2 Easing

- Single token: `--lp-ease` in globals.css only.
- `lib/ui/motion.css` uses `var(--lp-ease, cubic-bezier(0.2, 0.8, 0.2, 1))` — fallback duplicates globals and can drift.

### 3.3 components/ui

- Same pattern repeated: `transition-[...] duration-200 [transition-timing-function:var(--lp-ease)]` (or duration-150 for dialog trigger, button).
- No use of `--lp-duration-*` or `.lp-motion-*`; no reduced-motion handling for these transitions.

---

## 4. REDUCED-MOTION SUPPORT STATUS

| Area | Status |
|------|--------|
| `.lp-motion-*` (motion.css) | Covered: `transition: none !important` under `prefers-reduced-motion: reduce`. |
| .lp-btn, .lp-card, .lp-nav-item, .lp-hero-frame (globals) | Covered in globals.css. |
| .lp-link, .lp-related-card, .lp-section-img | **Not covered** in reduced-motion block. |
| .lp-shine (animation) | **Not covered.** |
| Tailwind-based transitions in components/ui (dialog, input, switch, checkbox, tabs, toast, button, table) | **Not covered** — no `prefers-reduced-motion` override. |
| Inline “transition” / “transition-all” in TSX | **Not covered.** |
| Tailwind `animate-spin` / `animate-pulse` | **Not covered** (Tailwind defaults). |

Print block in globals (around line 3410) uses `animation: none !important; transition: none !important` on `*` for print, which is correct for print only, not for reduced-motion.

---

## 5. PREVIEW / PUBLIC MOTION DIVERGENCE

| Surface | Observation |
|---------|-------------|
| **Public** (e.g. app/(public)/page.tsx, vilkar, kontakt, personvern) | Uses `.lp-card` without `.lp-motion-card`; links/buttons use bare `"transition"` or `"transition hover:text-[#ff007f]"`; no shared motion classes. |
| **Backoffice / editor** | Heavy use of `.lp-motion-btn`, `.lp-motion-card`, `.lp-motion-row`, `.lp-motion-overlay`, `.lp-motion-switch` in ContentWorkspace, BlockPickerOverlay, ContentSaveBar, ContentAiTools, ContentInfoPanel, BlockCanvas, ContentMainShell, ContentSeoPanel. |
| **Admin** (admin/*, superadmin/*) | Mix: some `lp-motion-*`, many ad hoc `"transition"` or `"transition hover:..."` on pills/buttons/cards. |

So: backoffice is aligned to motion.css; public and parts of admin are not.

---

## 6. ADDITIONAL GAPS

- **Modal/panel enter-exit:** Dialog (components/ui/dialog.tsx) mounts/unmounts with `if (!open) return null`. Panel has `transition-[transform,opacity] duration-200` but no enter/exit keyframes or data-state-based animation; no shared overlay enter/exit contract.
- **List/row motion:** `.lp-motion-row` is used in ContentWorkspace only; no list stagger or shared “list item enter” primitive.
- **Blocks:** No dedicated `components/blocks` folder; block-level motion lives in backoffice content components (BlockCanvas, BlockPickerOverlay) via `.lp-motion-card` / `.lp-motion-btn`.
- **Animation utilities:** `animate-spin` and `animate-pulse` used for loaders/skeletons; not part of motion token system; no reduced-motion override.
- **Token ownership:** Duration tokens live in motion.css (`:root`); easing in globals.css. motionTokens.ts documents “CSS counterpart: app/globals.css (--lp-duration-*, --lp-ease)” but `--lp-duration-*` are not in globals.css.

---

## 7. TOP BLOCKERS PREVENTING MOTION SYSTEM ≥100%

1. **Two parallel systems** — globals.css (`.lp-btn`, `.lp-card`, `.lp-nav-item`, `.lp-link`) and motion.css (`.lp-motion-*`) with overlapping semantics and no single rule for when to use which.
2. **motionTokens / motionClasses unused** — no programmatic use; string literals everywhere; no single source of truth in JS/TS.
3. **Inconsistent durations and units** — 120ms, 150ms, 200ms, 140ms, 220ms, 0.2s, 0.22s; mix of ms and s; no single “normal” or “fast” in Tailwind or shared utility.
4. **components/ui bypass motion system** — use Tailwind `duration-200`/`duration-150` and `var(--lp-ease)` directly; no use of motion tokens or motion classes; no reduced-motion.
5. **Public and some admin use bare “transition”** — no duration, ease, or reduced-motion (e.g. vilkar, kontakt, personvern, onboarding, admin pills).
6. **Incomplete reduced-motion** — .lp-link, .lp-related-card, .lp-section-img, .lp-shine, and all Tailwind-based transitions in UI components remain animated when user prefers reduced motion.
7. **Token split** — `--lp-ease` in globals; `--lp-duration-*` only in motion.css; motionTokens.ts references both but tokens not centralized in one place (and not used in code).
8. **No modal/overlay enter-exit contract** — dialogs/overlays have no defined enter/exit animation; panel transition is present but no coordinated overlay + content motion.
9. **Duplicate card transitions** — combining `.lp-card` and `.lp-motion-card` applies two transition rules to the same element.

---

## 8. EXACT FILES INVOLVED

### Core motion definition

- `lib/ui/motion.css` — motion primitives, durations, reduced-motion for .lp-motion-*
- `lib/ui/motionTokens.ts` — unused tokens and class names
- `app/globals.css` — --lp-ease; .lp-btn, .lp-card, .lp-nav-item, .lp-link, .lp-related-card, .lp-section-img; keyframes; reduced-motion for .lp-btn, .lp-card, .lp-nav-item, .lp-hero-frame
- `app/layout.tsx` — imports globals.css then motion.css

### Tailwind

- `tailwind.config.cjs` — no motion-related theme extension

### components/ui (inline duration/ease, no reduced-motion)

- `components/ui/input.tsx`
- `components/ui/select.tsx`
- `components/ui/textarea.tsx`
- `components/ui/checkbox.tsx`
- `components/ui/switch.tsx`
- `components/ui/button.tsx`
- `components/ui/dialog.tsx`
- `components/ui/toast.tsx`
- `components/ui/tabs.tsx`
- `components/ui/table.tsx`

### Backoffice (heavy lp-motion-* usage)

- `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx`
- `app/(backoffice)/backoffice/content/_components/ContentSaveBar.tsx`
- `app/(backoffice)/backoffice/content/_components/ContentAiTools.tsx`
- `app/(backoffice)/backoffice/content/_components/ContentInfoPanel.tsx`
- `app/(backoffice)/backoffice/content/_components/BlockPickerOverlay.tsx`
- `app/(backoffice)/backoffice/content/_components/BlockCanvas.tsx`
- `app/(backoffice)/backoffice/content/_components/ContentMainShell.tsx`
- `app/(backoffice)/backoffice/content/_components/ContentSeoPanel.tsx`
- `app/(backoffice)/backoffice/content/_components/ContentWorkspaceCreatePanel.tsx`
- `app/(backoffice)/backoffice/_shell/ModulesRail.tsx`

### Public / marketing (lp-card only or bare “transition”)

- `app/(public)/page.tsx`
- `app/vilkar/page.tsx`
- `app/kontakt/KontaktClient.tsx`
- `app/personvern/page.tsx`
- `app/onboarding/OnboardingForm.tsx`
- `components/AppHeader.tsx`
- `components/site/PublicHeader.tsx`

### Shared components (lp-card + lp-motion-card or lp-btn)

- `components/HowItWorks.tsx`, `components/Control.tsx`, `components/Pricing.tsx`, `components/Solution.tsx`, `components/Sustainability.tsx`, `components/Problem.tsx`
- `components/auth/LogoutButton.tsx`
- `components/site/AdminHeader.tsx`

### Other (ad hoc transition usage)

- `app/admin/insights/page.tsx`, `app/admin/locations/page.tsx`, `app/admin/history/page.tsx`, `app/admin/invite/page.tsx`
- `app/superadmin/companies/[companyId]/companies-client.tsx`, `app/superadmin/companies/[companyId]/Actions.tsx`
- `app/(portal)/week/WeekClient.tsx`
- `components/admin/BlockedState.tsx`, `components/superadmin/StatusDropdown.tsx`
- Plus loading/skeleton usage of `animate-pulse` / `animate-spin` in registrering, firms/loading, experiments, ContentSaveBar, MediaPickerModal, AdminEsgClient, etc.

---

## 9. SUMMARY

- **Shared primitives:** Present in `lib/ui/motion.css` and `app/globals.css`, with a clear split: durations in motion.css, ease in globals; `.lp-motion-*` used mainly in backoffice; `.lp-btn`/`.lp-card`/`.lp-nav-item`/`.lp-link` in globals used in public/admin.
- **Duplication:** Button and card semantics exist in both globals and motion.css; cards often use both classes; UI components reimplement transition timing without using motion tokens.
- **Inconsistency:** Multiple durations (120, 150, 140, 200, 220 ms and 0.2s, 0.22s), mixed units, and no single “normal” or “fast” standard in Tailwind or shared utility.
- **Reduced-motion:** Only `.lp-motion-*` and a subset of globals (`.lp-btn`, `.lp-card`, `.lp-nav-item`, `.lp-hero-frame`) are covered; .lp-link, .lp-related-card, .lp-section-img, .lp-shine, and all Tailwind-based transitions in components/ui are not.
- **Blocker summary:** Two parallel systems, unused motionTokens/motionClasses, inconsistent durations and units, UI components and public/admin bypassing the motion system, incomplete reduced-motion, split token ownership, no modal enter-exit contract, and duplicate card transitions.

To reach Motion System maturity ≥100%, the above blockers need to be addressed in small, targeted patches (single source of truth, adopt motion tokens/classes where appropriate, unify durations and reduced-motion, and define overlay/modal enter-exit behavior).
