# U30X-READ-R2 — Editor render / mount chain

**Kilde:** `app/(backoffice)/backoffice/content/**`, `layout.tsx`, `_shell/*`.

## Kjede (fra HTTP til canvas)

1. **`app/(backoffice)/backoffice/layout.tsx`** (server)  
   - Auth: `getAuthContext()` → kun `superadmin` → ellers `redirect(roleHome)`.  
   - Wrapper: `BackofficeShell` + `CmsRuntimeStatusStrip` + `CmsHistoryDiscoveryStrip`.

2. **`BackofficeShell.tsx`** (client)  
   - `TopBar` → `BackofficeExtensionContextStrip` → `BackofficeCommandPalette` → status-strip + history-strip → **én** `children`-kolonne med `overflow-hidden`.

3. **`app/(backoffice)/backoffice/content/layout.tsx`**  
   - `MainViewProvider` → **`ContentWorkspaceLayout`**.

4. **`ContentWorkspaceLayout.tsx`** (client)  
   - `ToastProvider` → `SectionSidebarContext` → **`SectionShell`**:  
     - **as `treeSlot`:** `ContentTree` + valgfri `sectionSidebarContent` overlay.  
     - **as `children`:**  
       - Hvis **`selectedNodeId` truthy:** `<ContentEditor nodeId={selectedNodeId} />` (uten `children` fra page).  
       - Hvis **null:** **`children`** fra route (f.eks. `GrowthDashboard` på `/backoffice/content`).

5. **`content/[id]/page.tsx`** (server)  
   - UUID → `ContentEditor` med `nodeId` + `focusBlock` fra query.  
   - Slug → redirect til UUID eller feil-UI + `CreateMissingPageClient`.

6. **`ContentEditor.tsx`**  
   - `ContentWorkspace` med `embedded`, `initialPageId`, `initialFocusBlockId`.

7. **`ContentWorkspace.tsx`**  
   - Hovedkomposisjon: `ContentWorkspaceFinalComposition` + hooks (`useContentWorkspaceData`, `useContentWorkspaceBlocks`, `useContentWorkspacePersistence`, `useContentWorkspaceAi`, …).  
   - Modaler: `ContentWorkspaceModalStack` (via modal shell / tri-pane).  
   - Canvas: `ContentWorkspaceMainCanvas` / preview-pane / chrome — **se imports** i filen.

## Tabell: Layer → fil → ansvar

| Layer | File | Responsibility | Mounted by | Runtime importance | Notes |
|-------|------|----------------|------------|-------------------|-------|
| **Route (server)** | `content/[id]/page.tsx` | UUID vs slug, focus, `CreateMissingPageClient` | Next.js | **Høy** | Eneste server-side entry til editor for UUID. |
| **Route (server)** | `content/page.tsx` | **GrowthDashboard** — ikke editor | Next.js | **Høy** for `/content` | Default “content” land = ikke tree-first editor. |
| **Section layout** | `content/layout.tsx` | `MainViewProvider` + workspace layout | Next.js | **Høy** | Wraps all content routes. |
| **Workspace layout** | `ContentWorkspaceLayout.tsx` | Tre + main; `children` vs `ContentEditor` | Client | **Høy** | Selection state kan overstyre page `children`. |
| **Shell** | `BackofficeShell.tsx` | Global topbar + palette + strips | `backoffice/layout.tsx` | **Høy** | Fast 100vh kolonne. |
| **Section shell** | `SectionShell.tsx` | 360–520px tre \| flex main | `ContentWorkspaceLayout` | **Høy** | `cmsSectionTreeAsideClass` + `cmsWorkspaceMainSurfaceClass`. |
| **Tree** | `ContentTree.tsx` | `GET /api/backoffice/content/tree`, navigasjon | `ContentWorkspaceLayout` | **Høy** | `schemaHint` ved degradert API. |
| **Editor host** | `ContentEditor.tsx` | Thin wrapper til `ContentWorkspace` | Layout eller page | **Høy** | `embedded` prop. |
| **Editor core** | `ContentWorkspace.tsx` | Full state, blocks, modals, AI | `ContentEditor` | **Kritisk** | Monolitt; mange side-effects. |
| **Modal stack** | `ContentWorkspaceModalStack.tsx` | Block add/edit/picker, AI full page | `ContentWorkspace` composition | **Høy** | Importerer modaler via `_stubs` (re-export). |
| **Canvas** | `ContentWorkspaceMainCanvas.tsx` | Hovedflate + preview-pane | `ContentWorkspaceFinalComposition` | **Høy** | Preview coupling. |
| **Header chrome** | `ContentWorkspaceHeaderChrome.tsx` | `ContentTopbar` + mode strip + recovery banner | Composition | **Høy** | Mange signaler. |
| **Save bar** | `ContentSaveBar.tsx` | Lagre/publiser handlinger | Composition | **Høy** | |
| **Properties** | `ContentWorkspacePropertiesRail.tsx` | Inspector / høyre rail | Composition | **Høy** | |
| **Runtime strip** | `CmsRuntimeStatusStrip.tsx` | server: `getControlPlaneRuntimeModules()` | `backoffice/layout` | **Støtte** | Read-only badges; ikke editor-data. |
| **History strip** | `CmsHistoryDiscoveryStrip` | discovery-lenker | `backoffice/layout` | **Støtte** | |

## API-kall på oppstart / ved bytte av side (kjerne)

| Behov | Typisk endpoint | Konsument |
|-------|-----------------|-----------|
| Tre | `GET /api/backoffice/content/tree` | `ContentTree` |
| Side detalj | `GET /api/backoffice/content/pages/[id]?...` | `useContentWorkspaceData` |
| Liste | `GET /api/backoffice/content/pages` | `useContentWorkspaceData`, `GrowthDashboard` |
| Hjem-root | `GET /api/backoffice/content/home` | `ContentTree` (klick “Hjem”) |
| Lagring | `PATCH /api/backoffice/content/pages/[id]` | `contentWorkspace.persistence.ts` |
| Publisering | `POST .../variant/publish` | `useContentWorkspaceWorkflow` |
| AI capability | `GET /api/backoffice/ai/capability` | `useContentWorkspaceAi` |
| Media | `GET /api/backoffice/media/items` | `MediaPickerModal` |

**Globale settings-kall** (avhengig av modus): `header-config/[variant]`, `footer-config`, design/global shell — se `ContentWorkspaceGlobalHeaderShell.tsx` og relaterte.

## AI-støtte (ikke én “oppstart”, men tett på editor)

- `useContentWorkspaceAi.ts` — `block-builder`, `page-builder`, `image-generator`, `layout-suggestions`, `design-suggestion/log-apply`, m.m.
- `contentWorkspace.aiRequests.ts` — `suggest`, m.fl.

Se `docs/umbraco-parity/U30X_READ_BLOCKS_MODALS_AND_SCHEMA_MAP.md` for blokker.
