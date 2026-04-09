# Phase 2A — CMS / backoffice shell uplift

## Goals

- Calmer, more **enterprise** backoffice chrome without changing routing, guards, or data.
- One accent: **hot pink** for primary navigation active state (underline), per AGENTS F6.

## Changes

### `BackofficeShell`

- Outer wrapper uses **`bg-[rgb(var(--lp-bg))]`** so backoffice sits on the same warm base as the rest of the product instead of stark white.

### `SectionShell` (tree + workspace)

- Aside (tree) uses **`cmsSectionTreeAsideClass`** from `lib/design/cmsShell.ts`:
  - Preserves `lp-glass-panel` and scroll behavior.
  - Adds **`border-r border-[rgb(var(--lp-border))]`** for a clear vertical separation from the main workspace.

### `TopBar`

- Active tab indicator: **`bg-[var(--lp-hotpink)]`**, height `h-[3px]` (replaces `bg-red-500` + inline style duplicate).

### `cmsShell.ts`

- **`cmsSectionTreeAsideClass`**: documented, reusable string for any future section layouts that use the same tree|main split.

## What stayed the same

- Tab list, hrefs, and active-path logic.
- No middleware, no API, no auth.

## Verification

- Visual: backoffice loads, tree and main column readable, no horizontal overflow introduced by border.
- Automated: `typecheck`, `build:enterprise` (see `PHASE2A_CHANGED_FILES.md`).
