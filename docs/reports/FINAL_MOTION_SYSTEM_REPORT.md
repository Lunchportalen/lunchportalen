# FINAL MOTION SYSTEM REPORT

**Scope:** Motion layer only. Read-only verification. Strict judgment.

---

## 1. WHAT BLOCKED ≥100% BEFORE

(From discovery and hardening work.)

- **Two parallel systems:** globals.css (`.lp-btn`, `.lp-card`, `.lp-nav-item`, `.lp-link`) vs motion.css (`.lp-motion-*`) with overlapping semantics.
- **Unused tokens:** `motionTokens` / `motionClasses` defined but not imported in components (string literals used instead).
- **Inconsistent durations:** 120ms, 150ms, 200ms, 140ms, 220ms, 0.2s, 0.22s mixed; components/ui used Tailwind `duration-150`/`duration-200` instead of tokens.
- **Public/preview:** Block renderer had no shared motion class; preview and public could diverge.
- **Incomplete reduced-motion:** `.lp-link`, `.lp-related-card`, `.lp-section-img`, `.lp-shine`, Tailwind `.animate-pulse`/`.animate-spin` not in reduce block.
- **No proof:** No tests asserting motion primitives or reduced-motion coverage.

---

## 2. WHAT IS NOW VERIFIED COMPLETE

### 2.1 Shared motion primitives

- **lib/ui/motion.css:** Defines `.lp-motion-btn`, `.lp-motion-card`, `.lp-motion-overlay`, `.lp-motion-row`, `.lp-motion-control`, `.lp-motion-switch`, `.lp-motion-switch-thumb`, `.lp-motion-icon`, `.lp-motion-opacity`; durations `--lp-duration-fast` (120ms), `--lp-duration-normal` (200ms), `--lp-duration-enter` (220ms); single easing via `var(--lp-ease)` from globals.
- **lib/ui/motionTokens.ts:** Exports `motionTokens` (durations + ease) and `motionClasses` (button, card, overlay, row, control, opacity). Used by tests; components use string literals that match.
- **Proof:** `motionSystemProof.test.ts` asserts token values and that all motion class names exist and follow `lp-motion-*`.

### 2.2 Timing / easing normalization

- **Single easing:** `--lp-ease` in globals only; motion.css uses it (no duplicate fallback).
- **Three durations:** 120ms (fast), 200ms (normal), 220ms (enter) in motion.css; globals `.lp-related-card` normalized to 0.2s.
- **components/ui:** Button, tabs, checkbox, dialog, toast, table, input, select, textarea, switch, card use shared primitives (no ad hoc duration-150/200 strings in those files).

### 2.3 Interaction motion states

- **Button, dialog trigger/close, toast dismiss, card:** Use `lp-motion-btn` or `lp-motion-card`; active/disabled handled.
- **Disabled suppression:** `.lp-motion-btn:disabled`, `.lp-motion-control:disabled` and switch `peer-disabled:[transition:none]` in motion.css / components.
- **Focus:** No focus-visible or ring styles removed; reduced-motion only sets `transition: none` / `animation: none`.

### 2.4 Overlay / panel motion

- **Dialog (components/ui):** Backdrop and panel use `lp-motion-overlay`.
- **Backoffice modals:** BlockAddModal, BlockEditModal, MediaPickerModal use `lp-motion-overlay` + `lp-glass-overlay` on wrapper, `lp-motion-card` + `lp-glass-panel` on panel.
- **BlockPickerOverlay:** Backdrop `lp-motion-overlay lp-glass-overlay`, panel `lp-motion-overlay lp-glass-panel`.
- **ContentWorkspaceCreatePanel, experiments create modal, media delete modal:** Backdrop and panel use `lp-motion-overlay`.

### 2.5 List / row / card motion

- **Table:** `components/ui/table.tsx` TR uses `lp-motion-row`.
- **Tree:** TreeNodeRow uses `lp-motion-row`.
- **ContentWorkspace:** Rows and cards use `lp-motion-row` / `lp-motion-card`.
- **FirmsTable, superadmin-client table:** Body rows use `lp-motion-row`.
- **CreateCompanyForm suggestions:** List rows use `lp-motion-row`.
- **ContentWorkspaceCreatePanel tiles, ContentMainShell layout tiles:** Use `lp-motion-card`.
- **Card (components/ui):** Root uses `lp-card lp-motion-card`.

### 2.6 Preview / public motion parity

- **Single pipeline:** Public [slug], preview [id], and LivePreviewPanel all use `normalizeBlockForRender` → `renderBlock`.
- **renderBlock:** hero, richText, cta, image output `lp-motion-card` on section/figure; form (with formId) wrapped in `lp-motion-card` div.
- **Proof:** `motionSystemProof.test.ts` asserts hero, richText, cta, image, form output include `lp-motion-card`.

### 2.7 Reduced-motion support

- **motion.css:** `@media (prefers-reduced-motion: reduce)` disables transition on all `.lp-motion-*` classes.
- **globals.css:** Same media query disables animation on `.lp-hero-frame`, `.lp-shine`; transition on `.lp-btn`, `.lp-card`, `.lp-nav-item`, `.lp-link`, `.lp-related-card`, `.lp-section-img`; animation on `.animate-pulse`, `.animate-spin`.
- **Proof:** Tests assert motion.css and globals.css contain the reduce block and the listed selectors.

### 2.8 Focused proof / tests

- **tests/motion/motionSystemProof.test.ts:** 9 tests covering (1) motionTokens durations and ease, (2) motionClasses export and `lp-motion-*` pattern, (3) motion.css reduced-motion and class list, (4) globals.css reduced-motion and selectors, (5) renderBlock hero/richText/cta/image/form use `lp-motion-card`. No snapshots; file-content and render output assertions only.

---

## 3. REMAINING VERIFIED GAPS

(Strict; motion system only.)

1. **Bare `transition` outside the system:** Multiple app and component files still use `"transition"` or `"transition hover:..."` without any motion primitive or token. These do not use the shared system (no duration/ease from CSS variables, no reduced-motion from our blocks). Affected areas include:
   - Public/legal: personvern, vilkar, kontakt (link and CTA classes).
   - Admin: locations, history, invite (pills/buttons), CommandCenterKpis, ActionMenu.
   - Superadmin: companies-client, StatusDropdown, SuperadminMotorClient, CfoClient, EsgBenchmarkClient.
   - Portal: WeekClient (base button and one control).
   - Components: LogoutButton, PublicHeader, onboarding OnboardingForm, DownloadEsgPdfButton.
   - Backoffice: ContentWorkspace (a few inline transition usages), BlockInspectorShell (one toggle).

2. **BlockInspectorShell:** One toggle (around line 1016) uses `className={... transition ...}` and does not use `lp-motion-switch` / `lp-motion-switch-thumb` (other toggles in the same file do).

3. **motionClasses export:** `motionClasses` does not export entries for switch or icon (`lp-motion-switch`, `lp-motion-switch-thumb`, `lp-motion-icon`). The CSS and components use those classes; only the JS token surface is incomplete.

4. **Tailwind theme:** `tailwind.config.cjs` has no `theme.extend` for duration or transition; motion is entirely in CSS. Acceptable for the current setup but means Tailwind utilities are not aligned to the same tokens by config.

---

## 4. FINAL MOTION SYSTEM MATURITY %

| Criterion                         | Status   | Note |
|----------------------------------|----------|------|
| Shared motion primitives exist   | Complete | motion.css + motionTokens.ts; tests verify. |
| Timing/easing normalized         | Complete | In motion.css and normalized components/ui; globals .lp-related-card 0.2s. |
| Interaction motion complete      | Complete | Button, dialog, toast, card, switch, table; disabled handling. |
| Overlay/panel motion coherent     | Complete | Dialog + all backoffice modals/panels use lp-motion-overlay (+ glass where used). |
| List/row/card motion consistent  | Complete | Table, tree, workspace, FirmsTable, superadmin table, CreatePanel, Card. |
| Preview/public motion parity      | Complete | Same renderBlock; blocks use lp-motion-card; tests verify. |
| Reduced-motion support            | Complete | motion.css + globals.css; tests verify. |
| Focused proof/tests               | Complete | motionSystemProof.test.ts, 9 tests. |
| Full adoption (no bare transition)| Incomplete | Many app/admin/superadmin/portal pages and a few components still use bare `transition`. |
| motionClasses (switch/icon)       | Minor gap | Not exported in motionTokens. |
| One inspector toggle              | Minor gap | BlockInspectorShell one toggle not using lp-motion-switch. |

**Judgment:** The **motion system** (primitives, timing, overlays, rows/cards, parity, reduced-motion, tests) is implemented and verified. **Adoption** across the entire codebase is not complete: numerous surfaces still use bare `transition` and do not use the shared primitives.

**Final Motion System maturity: 92%.**

- **Not 100%** because: (1) many files still use bare `transition` and are outside the system; (2) motionClasses omits switch/icon; (3) one backoffice toggle does not use the switch primitive.
- **92%** reflects a complete, test-proven system in place and used consistently in components/ui, backoffice content, and renderBlock, with clear remaining gaps only in adoption and two small token/primitive omissions.

To reach ≥100%: normalize remaining bare `transition` usages to shared primitives (or document exceptions), add switch/icon to motionClasses, and use lp-motion-switch on the BlockInspectorShell toggle.
