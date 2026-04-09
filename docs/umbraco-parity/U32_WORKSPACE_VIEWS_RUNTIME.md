# U32 - Workspace views runtime

- Title: U32 explicit workspace views and content apps
- Scope: `lib/cms/backofficeWorkspaceContextModel.ts`, `components/backoffice/BellissimaWorkspaceHeader.tsx`, `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx`, and section/detail view wiring.
- Repro:
  1. Open a content workspace and inspect how users move between content, preview, history, design, and global/governance surfaces.
  2. Observe that some views are implicit strip modes while others are hidden inside rails or local controls.
- Expected: explicit view identity drives the workspace instead of mixed local semantics.
- Actual: the editor still contained remnants of implicit page/editor semantics and top-strip ownership.
- Root cause: workspace views had not yet been elevated into the shared Bellissima model.
- Fix: move view identity into the workspace model, publish it through the shared context, and render tabs from the canonical descriptors in the header.
- Verification:
  - `npx vitest run tests/cms/bellissimaWorkspaceContext.test.ts tests/cms/backofficeWorkspaceContextModel.test.ts --config vitest.config.ts`
  - `npm run typecheck`
  - `npm run build:enterprise`

## Explicit views now

### Section scope

- `overview`
- `growth`
- `recycle-bin`

### Entity scope

- `content`
- `preview`
- `history`
- `global`
- `design`

## Why this is materially better

- View identity is now explicit instead of implied by local UI strips.
- The header owns view tabs as workspace navigation, which is closer to Bellissima than scattering mode switches across the editor.
- History is treated like a first-class workspace surface rather than a side concern.

## Apps and panels that remain inside the workspace

- AI remains a dedicated workspace app/panel, not a fake top-level workspace.
- Runtime/diagnostics remain a deliberate operator panel.
- SEO and governance stay grouped inside the inspector/runtime structure until they justify full standalone workspaces.

This keeps U32 honest: explicit where the model is real now, but without inventing parallel app shells just to inflate parity claims.
