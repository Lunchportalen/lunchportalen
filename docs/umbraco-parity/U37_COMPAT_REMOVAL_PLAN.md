# U37 Compat Removal Plan

## Remove
- `app/(backoffice)/backoffice/content/_components/blockRegistry.ts`
  - Reason: competes with `editorBlockCreateOptions.ts` and hardens duplicate block truth.
  - U37 action: replace with one canonical catalog in `lib/cms`.

- `app/(backoffice)/backoffice/content/_components/contentWorkspaceWorkspaceRootImports.ts`
  - Reason: zero-logic import barrel still obscures ownership inside the main workspace.
  - U37 action: import canonical modules directly from `ContentWorkspace.tsx`.

## Reduce To Wrapper
- `lib/cms/editorBlockCreateOptions.ts`
  - Reason: keep public API for settings/governance callers, but stop owning a separate static list.
  - U37 action: derive from the canonical block catalog.

## Keep But Box In
- `contentWorkspacePageEditorShellInput.ts`
  - Reason: bundle-builder still reduces prop noise, but must not grow new ownership.
  - U37 action: keep props-only, no runtime truth or view logic.

- `contentWorkspaceTriPaneShellBundle.ts`
  - Reason: still wires shell slices, but must stay assembly-only.
  - U37 action: no new business logic; only canonical shell wiring allowed.

## Stop Rule
- No new `v2`, `v3`, `next`, `compat`, or alternate workspace registries.
- If a wrapper remains, it must point to one canonical model and add no competing decisions.
