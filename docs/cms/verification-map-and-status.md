# CMS verification map and status

Senior CMS reliability view: core surfaces, verification map, and status. Preview and save-state semantics are only marked VERIFIED where actually exercised in tests.

---

## 1. CMS verification map

| Area | Entrypoint / path | Data flow | Save/publish | Evidence |
|------|-------------------|-----------|--------------|----------|
| **Tree** | ContentTree, GET /api/backoffice/content/tree | fetchTree() → roots; loadError on failure; flattenVisible(roots) → TreeNodeRow | — | E2E: tree load, Hjem single, no duplicate Forside, selection → workspace; code: isLoading, loadError, empty roots safe |
| **Editor** | ContentWorkspace (content/[id]), useContentWorkspacePageData | GET /api/backoffice/content/pages/:id → applyParsedBody, setSavedSnapshot | performSave() → PATCH pages/:id; saveDraft("manual"\|"autosave") | E2E: workspace open, Lagre → Sist lagret; persistence test: PATCH→GET |
| **Preview (in-editor)** | LivePreviewPanel | Draft blocks → normalizeBlockForRender → renderBlock (same as public) | — | Code: same pipeline as public; parity banner (previewDiffersFromPublished). Not exercised in E2E |
| **Preview (route)** | /backoffice/preview/[id] | Server: content_pages + content_page_variants (preview or prod) → parseBody → normalizeBlockForRender → renderBlock | — | Same pipeline as public [slug]. E2E: **cms-preview-route-smoke** loads page, expects banner "Forhåndsvisning" / "kladd" |
| **Save state** | useContentWorkspaceSave, ContentSaveBar | savedSnapshot vs currentSnapshot → dirty; lastSavedAt, lastError | performSave → PATCH; applyLoadSuccess on GET | E2E: editor-save-smoke, ai-cms click Lagre → "Sist lagret". Persistence test: GET after PATCH |
| **Publish state** | ContentTopbar (canPublish, onPublish, onUnpublish) | Status, publishedAt; variant publish API | Publish/unpublish actions | **Not exercised in E2E** |
| **Content fetch/reload** | useContentWorkspacePageData loadPage() | GET /api/backoffice/content/pages/:id → applyLoadSuccess in save hook | — | Persistence test + editor reload in ai-cms |

**Document type binding:** documentTypeAlias, documentTypes, envelope (bodyEnvelope); used in create panel and body persistence. No dedicated E2E; covered implicitly by editor/create flows.

---

## 2. Status matrix

| CMS AREA | STATUS | EVIDENCE | EXACT FILES INVOLVED | MAIN RISK |
|----------|--------|----------|----------------------|-----------|
| **Content tree** | VERIFIED | Tree loads; single Hjem; no duplicate Forside; selection opens correct document; Global/App overlays/Design folder-only; preview action opens public URL. Code: loadError, isLoading, empty roots safe. | ContentTree.tsx, treeTypes.ts, TreeNodeRow.tsx, treeMock (flattenVisible, findNode); GET /api/backoffice/content/tree; e2e/backoffice-content-tree.e2e.ts | Tree API failure only code-tested; E2E uses real API |
| **Content workspace** | VERIFIED | Selection opens workspace; URL content/:id; main visible; "forside\|innhold\|redigere\|velg en side". Slug-not-found → CreateMissingPageClient. | ContentWorkspace.tsx, ContentEditor.tsx, content/[id]/page.tsx, useContentWorkspacePageData.ts; backoffice-content-tree.e2e.ts, editor-save-smoke.e2e.ts | Stale mismatch possible if multiple tabs; not tested |
| **Editor (open + load)** | VERIFIED | Open by id → workspace; title input, Lagre; loadPage GET. | ContentWorkspace.tsx, useContentWorkspacePageData.ts, ContentTopStatusPanel.tsx; editor-save-smoke, ai-cms | — |
| **Save state** | VERIFIED | Lagre → "Sist lagret"; PATCH → GET returns same value (persistence test). Dirty, lastSavedAt, lastError in hook. | useContentWorkspaceSave.ts, ContentSaveBar.tsx, app/api/backoffice/content/pages/[id]/route.ts; tests/cms/content-persistence-save-reload.test.ts, editor-save-smoke.e2e.ts, ai-cms.e2e.ts | — |
| **Preview (in-editor LivePreviewPanel)** | PARTIAL | Real: same normalizeBlockForRender → renderBlock; parity banner. Not exercised in E2E (no test toggles preview column or asserts content). | LivePreviewPanel.tsx, ContentMainShell.tsx, previewParity.ts, renderBlock, normalizeBlockForRender | Disconnect from public render if pipeline diverges; not E2E-checked |
| **Preview (route /backoffice/preview/[id])** | VERIFIED | Same pipeline as public; server parseBody → normalizeBlockForRender → renderBlock. E2E: **cms-preview-route-smoke** opens preview for page, expects 200 and "Forhåndsvisning" or "kladd" banner. | app/(backoffice)/backoffice/preview/[id]/page.tsx, parseBody, normalizeBlockForRender, renderBlock; e2e/cms-preview-route-smoke.e2e.ts | Preview env = staging; prod variant fallback; no E2E assertion on block content |
| **Publish state** | NOT TESTED | UI exists (ContentTopbar canPublish, onPublish, onUnpublish). No E2E clicks Publish or asserts published state. | ContentTopbar.tsx, useContentWorkspaceSave (publish not in scope of persistence test) | Publish flow or permission bugs untested |
| **Content fetch/reload path** | VERIFIED | loadPage GET; applyLoadSuccess sets savedSnapshot. Persistence test: GET after PATCH returns payload. | useContentWorkspacePageData.ts, useContentWorkspaceSave.ts (applyLoadSuccess); content-persistence-save-reload.test.ts | — |
| **Empty state (tree)** | PARTIAL | Code: roots=[], loadError shown; no E2E with empty tree (would need mock or empty DB). | ContentTree.tsx (loadError, isLoading, flat from roots) | — |
| **API failure (workspace)** | PARTIAL | Code: detailError, pageNotFound, clearSaveStateOnLoadError. No E2E that forces 404/5xx on page load. | useContentWorkspacePageData.ts, ContentWorkspace (pageNotFound, detailError) | — |
| **Document type binding** | PARTIAL | Used in create and envelope; no dedicated E2E. | documentTypes.ts, bodyEnvelope.ts, ContentWorkspaceCreatePanel.tsx, useContentWorkspaceBlocks.ts | — |

---

## 3. Preview classification

| Preview surface | Type | Notes |
|-----------------|------|--------|
| **LivePreviewPanel (in editor)** | Real | Same pipeline as public; shows "Utkast", parity vs published. Not E2E-exercised. |
| **/backoffice/preview/[id]** | Real | Server; same parseBody → normalizeBlockForRender → renderBlock. E2E: route loads, banner visible. Connected to public render truth (same libs). |
| **Node action "Forhåndsvis"** | Public URL | Opens public / or /week etc. in new tab; not draft preview route. |

---

## 4. Test added this pass

- **e2e/cms-preview-route-smoke.e2e.ts** — One test: superadmin → create page via API → open `/backoffice/preview/{pageId}` → expect 200 and page content containing "Forhåndsvisning" or "kladd" (banner). Proves preview route loads and uses draft/preview path without crash.

No other new tests. Tree, workspace, save state, and content fetch/reload were already covered; publish and in-editor preview remain not exercised.
