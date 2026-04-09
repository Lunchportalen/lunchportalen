# U32 Workspace Host Model

- Title: Canonical content workspace host model
- Scope: content section routing, tree binding, section shell, detail editor mount, and transitional host layers.
- Repro:
  1. Compare `content/layout.tsx`, `ContentWorkspaceLayout.tsx`, `ContentWorkspace.tsx`, and the unused Bellissima shell path.
  2. Observe that tree, views, footer, and entity/workspace posture are split across multiple layers.
- Expected: one canonical host owns section -> tree -> workspace composition for both content landing and content detail routes.
- Actual: section shell, view state, footer state, and editor detail state are owned by different layers and partially duplicated.
- Root cause: the active host path was never fully consolidated after earlier Bellissima-inspired extraction phases.
- Fix: introduce one canonical content workspace host and route both landing and detail flows through it, while neutralizing transitional host layers.
- Verification:
  - content root renders through the host
  - detail route renders through the same host
  - tree selection and workspace routing stay aligned

## Canonical Routes

- Canonical content landing: `/backoffice/content`
- Canonical content workspace detail: `/backoffice/content/[id]`

## Canonical Host

- Canonical host component: `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceHost.tsx`
- Host responsibilities:
  - section -> tree -> workspace composition
  - selected tree identity bound to route
  - workspace context initialization and reset
  - workspace view switching
  - workspace header/actions/entity-actions
  - persistent footer apps/status
  - safe mounting of landing vs detail workspace

## Transitional Paths To Neutralize Now

- `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceLayout.tsx`
  - becomes thin compatibility wrapper or alias to the canonical host
- `app/(backoffice)/backoffice/content/_workspace/BellissimaContentWorkspaceShell.tsx`
  - no longer treated as an alternative host path
- `lib/cms/bellissimaWorkspaceContext.tsx`
  - no longer treated as a parallel runtime context source for content workspaces
- `app/(backoffice)/backoffice/content/_workspace/ContentDashboard.tsx`
  - no longer the live content landing surface

## Section -> Tree -> Workspace Flow

1. Section route enters `ContentWorkspaceHost`.
2. Host resolves the active content route posture:
   - content landing
   - content detail workspace
   - secondary workspace such as recycle bin or growth
3. Host mounts `SectionShell` with `ContentTree` as primary navigation.
4. Tree selection updates route identity; route remains source of truth for mounted workspace.
5. Host publishes one shared workspace context for header, footer, views, actions, and entity actions.
6. Detail route mounts `ContentWorkspace` inside the same host rather than creating a second workspace shell.
