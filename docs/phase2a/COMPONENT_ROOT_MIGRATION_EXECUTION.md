# Phase 2A — Component root migration

## Slice migrated (V3 addendum)

**`src/components/layout/PageContainer.tsx`** — layout wrapper brukt i CMS canvas (`@/components/layout/PageContainer` → `src` først via tsconfig).

Transitional: `components/layout/PageContainer.tsx` re-eksporterer.

## Earlier slice

**`src/components/ui/ds/**`** — design-system primitives:

- `Button.tsx`, `Card.tsx`, `Badge.tsx`, `EmptyState.tsx`, `Toolbar.tsx`, `Icon.tsx`, `dsDevWarnings.ts`, `index.ts`

## Transitional pattern

- **`components/ui/ds/index.ts`** re-exports:

  ```ts
  export * from "../../../src/components/ui/ds/index";
  ```

- **Imports:** `@/components/ui/ds` resolves to **`src/components`** first (tsconfig paths); the old folder is only a compatibility shim.

## Remaining in legacy `components/` (not migrated in 2A)

- **`components/ui/Icon`** (semantic registry) — separate from `DsIcon`; keep until a dedicated migration pass defines barrel strategy.
- **Other `components/ui/*`** — migrate case-by-case to avoid breaking deep imports.

## Verification

- `grep` for `@/components/ui/ds` — should resolve to `src` implementations.
- `typecheck` after move — PASS.
