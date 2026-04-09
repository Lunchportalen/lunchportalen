# U38 Workspace Truth Model

## Canonical Chain

1. `useContentWorkspaceBellissima` builds the entity snapshot.
2. `buildContentBellissimaWorkspaceModel()` resolves views, actions, entity actions, side apps, and footer apps from that snapshot.
3. `ContentWorkspacePageEditorShell` and related shell components render the workspace from that single model.
4. `ContentWorkspacePropertiesRail` now links directly back into settings management objects for the active document type.

## U38 Tightening

- Block insertion uses one visible path: `blockPickerOpen` + `addInsertIndexRef`.
- Settings links now show up both in footer shortcuts and in governance rail cards.
- Document-type-driven editor context is no longer only implicit in save validation; it is visible as a management flow in the workspace.

## Remaining Truth Boundaries

- Editor content/state: `ContentWorkspace` + hook composition.
- Runtime delivery: existing published/public route chain.
- Management read/control plane: settings workspaces and Bellissima footer/entity actions.
