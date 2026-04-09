# U33 Workspace Host Model

- Title: Canonical content host model for U33
- Scope: content section routing, host mounting, tree/workspace flow, and transitional path removal.
- Repro:
  1. Enter `/backoffice/content`.
  2. Select a node from the content tree.
  3. Switch between section landing and entity workspace.
- Expected: the section always mounts one host that owns tree + route truth + workspace shell composition.
- Actual: the current line is close, but old Bellissima shells still exist and route/selection truth is split across several helpers/components.
- Root cause: Bellissima parity was layered on top of earlier content shells instead of completing the replacement.
- Fix: keep one host and retire transitional mount paths/files now.
- Verification:
  - `/backoffice/content` renders the section landing inside the canonical host.
  - `/backoffice/content/[id]` renders the entity workspace inside the same canonical host/context line.
  - Tree selection and route selection stay aligned.

## Canonical Routes

- Canonical content landing: `/backoffice/content`
- Canonical workspace detail: `/backoffice/content/[id]`

## Canonical Host

- Canonical host component: `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceHost.tsx`
- Section mount: `app/(backoffice)/backoffice/content/layout.tsx`
- Section shell wrapper: `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceShell.tsx`

## Transitional Paths To Retire Now

- `app/(backoffice)/backoffice/content/_workspace/BellissimaContentWorkspaceShell.tsx`
- `lib/cms/bellissimaWorkspaceContext.tsx`
- `components/backoffice/BellissimaWorkspaceTabs.tsx`
- `components/backoffice/BellissimaWorkspaceFooter.tsx`
- Route parsing duplicated outside the canonical host/tree line

## Section -> Tree -> Workspace Coupling

- Section entry always lands in the content host with tree visible.
- Tree node selection drives route navigation, not local detached editor state.
- Route state determines whether the host shows section landing or entity workspace.
- Workspace chrome, views, actions, and footer apps are published through the shared Bellissima workspace context.
- Transitional section content such as growth/recycle bin remains routed by the same host, but does not introduce a parallel content editor stack.
