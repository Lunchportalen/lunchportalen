# Content workspace — moduler (Fase 1)

Strukturelle aliaser for ansvar (ingen ny atferd):

| Modul | Kilde |
|-------|--------|
| `ContentWorkspaceShell` | `ContentWorkspaceWorkspaceFrame` |
| `ContentTreePane` | `ContentWorkspaceLegacySidebar` |
| `ContentCanvasPane` | `ContentWorkspaceMainCanvas` |
| `ContentInspectorPane` | `BlockInspectorShell` |
| `ContentAiAssistantPane` | `EditorAiPanel` |
| `ContentPublishBar` | publiseringsrail i `ContentWorkspacePageEditorShell` (chrome.editor) |
| `ContentHistoryPanel` | `ContentPageVersionHistory` |

Importer fra `@/app/(backoffice)/backoffice/content/_components/workspace` eller relative stier.

`components/` (rot) er overgangsmappe; kanonisk komponentrot er `src/components/` (se `tsconfig.json`).
