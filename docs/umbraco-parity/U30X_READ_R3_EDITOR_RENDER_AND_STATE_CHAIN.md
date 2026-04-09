# U30X-READ-R3 — Editor render and state chain

## Mount-kjede (bevisbasert)

1. **Route:** `app/(backoffice)/backoffice/content/[id]/page.tsx` → `ContentEditor` (UUID) eller redirect/slug-oppslag.  
2. **Layout:** `content/layout.tsx` → `MainViewProvider` + `ContentWorkspaceLayout`.  
3. **Section shell:** `SectionShell.tsx` — grid trekolonne + `cmsWorkspaceMainSurfaceClass`.  
4. **Tree:** `ContentTree` i `treeSlot`; valg setter `selectedNodeId`.  
5. **Workspace:** `ContentWorkspaceLayout` linje 76: `selectedNodeId ? <ContentEditor nodeId={selectedNodeId} /> : children`.  
6. **Editor:** `ContentEditor.tsx` → `ContentWorkspace` med `embedded`.  
7. **Topbar / chrome:** `ContentWorkspaceHeaderChrome`, `ContentTopbar`, `ContentSaveBar` (via composition i `ContentWorkspace.tsx` / final composition).  
8. **Canvas / preview:** `ContentWorkspaceMainCanvas.tsx` → `ContentWorkspacePreviewPane`.  
9. **Inspector:** `ContentWorkspacePropertiesRail.tsx`, `BlockInspectorShell.tsx`.  
10. **Modaler:** `ContentWorkspaceModalStack.tsx` — inkl. `BlockPickerOverlay`, AI full page modal.

## Tabell: Layer → eierskap

| Layer | File | Responsibility | Mounted by | State owner | Runtime importance | Parity class | Notes |
|-------|------|----------------|------------|-------------|-------------------|--------------|-------|
| Page route | `[id]/page.tsx` | UUID vs slug; focus block query | Next.js | URL | Høy | **CODE_GOVERNED** | Fail-closed create UI ved ukjent slug |
| Section layout | `ContentWorkspaceLayout.tsx` | Tre + main; tree selection | layout | `useState(selectedNodeId)` | Høy | **PARTIAL** | Når `selectedNodeId` satt, **overskriver** `children` med `ContentEditor` — deep link vs tree kan divergere i oppførsel |
| Shell | `SectionShell.tsx` | Layout grid | layout | props | Medium | **UX_PARITY_ONLY** | |
| Workspace body | `ContentWorkspace.tsx` | Hele editor-logikk | `ContentEditor` | Mange `useState` + hooks | Kritisk | **STRUCTURAL_GAP** | Ingen én `WorkspaceContext` — eksplisitt i `backofficeWorkspaceContextModel.ts`: ingen global React Context |
| Data | `useContentWorkspaceData`, persistence hooks | Last/lagre side | `ContentWorkspace` | hooks | Kritisk | **CODE_GOVERNED** | API `/api/backoffice/content/pages/*` |
| Blocks | `useContentWorkspaceBlocks` | Blokkliste DnD | `ContentWorkspace` | hooks | Kritisk | **PARTIAL** | |
| AI | `useContentWorkspaceAi`, `contentWorkspace.aiRequests.ts` | Forslag, apply | `ContentWorkspace` | hooks | Variabel | **PARTIAL** | Metrics/logging til `logEditorAiEvent` |
| Modaler | `ContentWorkspaceModalStack.tsx` | Stack | `ContentWorkspace` | props | Medium | **PARTIAL** | |

## Hvor state *burde* vært workspaceContext (Bellissima)

- **Document type / envelope / slug / title** — i dag: `useState` i `ContentWorkspace.tsx` (linje 176–184 område i utdrag).  
- **Main view / global vs design** — `useContentWorkspaceShell`.  
- **Outbox** — `contentWorkspace.outbox.ts` (lokal persistence).  

**Konklusjon:** **STRUCTURAL_GAP** — typene i `backofficeWorkspaceContextModel.ts` beskriver *intensjon*, men editor bruker **props og lokal state**, ikke isolert workspace-instans context som Umbraco 17.
