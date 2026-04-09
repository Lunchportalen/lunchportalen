# U37 Workspace Truth Model

## Canonical Host
- `ContentBellissimaWorkspaceContext` is the visible workspace truth for header, views, actions, side apps, inspector sections, and footer apps.
- Section publication and entity publication may coexist internally, but only one resolved publication is allowed to drive the shell.

## Editor Ownership
- `ContentWorkspace.tsx` may orchestrate data loading, but it must not own separate action/view/footer truth outside the Bellissima snapshot.
- Preview layout mode, active side app, active inspector section, and active workspace view must resolve from the shared Bellissima context.

## Block Flow
- One block catalog defines discovery metadata, labels, descriptions, categories, and create defaults.
- One block creation path instantiates new blocks from that same catalog.
- Quick add and full picker may differ in UX, but not in block truth.

## Inspector / Preview Hierarchy
- Preview is a workspace view and presentation state.
- Inspector is a side-app/section state inside the same workspace model.
- No separate custom truth for “preview mode” vs “inspector mode” outside the shared workspace host.

## Guardrail
- If a helper or bundle file does not own state, it must stay assembly-only.
- If a file owns truth, it must be visible and canonical in the workspace chain.
