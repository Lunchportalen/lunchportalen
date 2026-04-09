# U31R Backoffice IA Runtime

- Title: Calm the backoffice shell and restore section-first information architecture
- Scope: `app/(backoffice)/backoffice/_shell/BackofficeShell.tsx`, `app/(backoffice)/backoffice/_shell/TopBar.tsx`, `app/(backoffice)/backoffice/_shell/SectionShell.tsx`, and `lib/cms/backofficeExtensionRegistry.ts`.
- Repro:
  1. Open the CMS editor and inspect the top chrome.
  2. Compare module density, tree width, and command/status placement against the intended section -> tree -> workspace hierarchy.
- Expected: the shell should communicate section context first, keep status/command context together, and let the content tree read as primary navigation.
- Actual: the top chrome was too flat, the command/status surfaces competed with the workspace, and the tree column was too visually weak.
- Root cause: Bellissima-style structure existed in pieces, but shell chrome and workspace framing still made the editor feel fragmented.
- Fix: separate the command/status strip from the main workspace frame, reduce topbar module noise, widen the section tree column, and keep one stronger workspace container around the active section.
- Verification:
  - `npm run typecheck`
  - `npm run build:enterprise`
  - `npm run test:run`

## Shell Outcome

- `BackofficeShell` now groups extension context, command palette, runtime strip, and history strip into a dedicated status/control band above the workspace.
- The main section content sits inside one rounded shared surface, reducing the previous box-in-box feel without changing route logic.
- No auth, redirect, or tenant logic was touched.

## Topbar Outcome

- `TopBar` now presents:
  - section badges for `Backoffice` and plane posture
  - one section selector instead of dense tab clutter
  - two summary cards for module count and overflow posture
  - a calmer module row with explicit overflow under `Flere`
- `BACKOFFICE_TOPBAR_MODULE_OVERFLOW` is now `4`, which reduces visual crowding while preserving access to the remaining modules.

## Section Layout Outcome

- `SectionShell` widens the tree column to `minmax(400px, min(38vw, 620px))`, giving tree navigation materially more presence.
- The workspace column keeps its own surface and scroll area, so tree and editor no longer read as one compressed slab.
- U31R keeps the existing registry as the single source of truth for section metadata and module placement.
