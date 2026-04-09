# Phase 1C — ContentWorkspace dypere splitt

## Ny modul

**`ContentWorkspaceEditorMountRouter.tsx`**

- **Ansvar:** Velge mellom `ContentWorkspaceEditor2ShellMount` og `ContentWorkspaceTriPaneMount` når `page` er lastet og det ikke er konflikt-tilstand.
- **Props:** `useEditor2`, `editor2Model` (`BlockList | null`), `editor2MountProps` (`Record<string, unknown>`), `triPaneMountProps` (`ContentWorkspaceTriPaneMountProps` — typet mot `contentWorkspaceTriPaneMountProps.ts`).

## Endring i `ContentWorkspacePageEditorShell.tsx`

- Tidligere inline JSX for Editor2 vs tri-pane er erstattet med én `<ContentWorkspaceEditorMountRouter ... />`.
- Ingen endring i forretningslogikk eller state — kun struktur.

## Ikke splittet (med vilje)

- Publish-bar, inspector og canvas ligger fortsatt i `ContentWorkspaceEditorChrome` / tri-pane-kjeden; videre utpakking hører til Fase 2.
