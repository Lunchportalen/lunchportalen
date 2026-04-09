# U21 — Workspace context runtime

## Kanonisk modell

- **`lib/cms/backofficeWorkspaceContextModel.ts`**: `WorkspaceStatusChip`, `WorkspaceActionKind`, `workspaceLifecycleLabel`, utvidet `BackofficeWorkspaceSession`.
- **`WorkspaceContextChrome`**: viser `contextSummary` + `statusChips` under lead.

## Surface

- **`BackofficeWorkspaceSurface`**: nye valgfrie props `contextSummary`, `statusChips`, `secondaryActions`, `footerApps` (toolbar = primære handlinger).

## Header (media)

- **`BackofficeWorkspaceHeader`**: samme kontekst-felter for klient-sider uten full surface.

## Ikke-mål

- Ingen global React Context eller ny workspace-motor.
