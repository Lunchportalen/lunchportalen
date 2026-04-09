# Phase 1B — ContentWorkspace split (oppførsel uendret)

## Endring

Ny modul **`ContentWorkspaceFinalComposition.tsx`** (`app/(backoffice)/backoffice/content/_components/`):

- Tar tre `ReactNode`-prop: `debugOverlays`, `workspaceFrame`, `modalShell`.
- Renderer `ContentWorkspaceShellGlobalStyles` til slutt (samme som i monolitten).

`ContentWorkspace.tsx` returnerer nå `ContentWorkspaceFinalComposition` med:

- **debugOverlays** (`ContentWorkspaceDevDebugOverlays`)
- **workspaceFrame** (`ContentWorkspaceWorkspaceFrame` + `ContentWorkspaceLegacySidebar` + `ContentWorkspacePageEditorShell` + bundles)
- **modalShell** (`ContentWorkspaceModalShell` + modal props bundle)

## Ikke gjort (med vilje)

- Ingen redesign, ingen ny forretningslogikk.
- Ingen oppdeling av hooks/state — fortsatt i `ContentWorkspace.tsx` (fremtidig fase).

## Filer

- `ContentWorkspaceFinalComposition.tsx` — ny
- `ContentWorkspace.tsx` — import + refaktor return; fjernet direkte import av `ContentWorkspaceShellGlobalStyles` (flyttet inn i composition)
