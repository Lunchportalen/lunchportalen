# CMS/Editor Architecture — Phase 0 Audit, Target Architecture, Gap Analysis & Implementation Plan

**Date:** 2026-03-10  
**Scope:** Lunchportalen backoffice CMS, editor, public rendering, AI layer.  
**Goal:** Map current state, define target (Umbraco/uSkinned-grade + AI-native), gap analysis, phased implementation.

---

## Phase 0 — Full Repo Audit Summary

### 1. Content tree

| Area | Finding |
|------|--------|
| **Implementation** | `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx` + `TreeNodeRow.tsx`, `treeTypes.ts`, `treeMock.ts` (helpers only). |
| **Data source** | **Persisted.** GET `/api/backoffice/content/tree` reads `content_pages` (tree_parent_id, tree_root_key, tree_sort_order) and builds virtual roots (Hjem, App overlays, Global, Design). Single source of truth. |
| **Navigation** | Home → GET `/api/backoffice/content/home` → redirect to `/backoffice/content/{pageId}`. By slug → GET `/api/backoffice/content/pages/by-slug?slug=…` → redirect to UUID. UUID → direct navigation to `/backoffice/content/{id}`. |
| **Move** | Persisted via POST `/api/backoffice/content/tree/move` (page_id, parent_page_id or root_key, sort_order). Cycle check enforced. |
| **Create/rename/delete** | Not in tree. Create, rename, delete are done in the editor (ContentWorkspace / list panel). Tree shows only: Kopier lenke, Forhåndsvis, Flytt (for document nodes). No Recycle Bin node. |
| **Policies** | `permissionsForNode`: canMove true only for document nodes (UUID); canCreate/canRename/canDelete false. NodeActionsMenu shows only supported actions (no disabled fake affordances). |

**Verdict:** Tree is **persisted navigation** with move; one truth model. See `docs/CONTENT_TREE_TRUTH.md`.

---

### 2. Content / page editor

| Area | Finding |
|------|--------|
| **Entry** | `content/page.tsx` → ContentDashboard; `content/[id]/page.tsx` → ContentEditor(id) → **ContentWorkspace** from `_components/ContentWorkspace.tsx`. |
| **Size** | ContentWorkspace is a **~7 400-line** single component. |
| **Layout** | Left: list/tree (dashboard) or embedded editor; center: block list + per-block inline forms; right: ContentInfoPanel + settings tabs (general, analytics, form, shop, navigation, footer, design, scripts, advanced). Top: ContentTopbar (status, title, slug, Publish/Unpublish), ContentSaveBar (Lagre og forhåndsvis, Lagre). |
| **Block editing** | Inline: each block type (hero, richText, image, cta, banners, code, divider) has its own form **inside** ContentWorkspace. No separate BlockEditModal (stub returns null). BlockCanvas used for drag-drop list with optional `renderBlockPreview` (not wired to shared renderBlock). |
| **Add block** | BlockPickerOverlay (categories, search, favorites/recent from localStorage). Registry from `lib/cms/plugins` (coreBlocks: hero, richText, image, cta, banners, divider, code, windows, form). |
| **Stubs** | `_stubs.ts`: BlockAddModal, BlockEditModal, MediaPickerModal, Editor2Shell, validateModel — all no-op or minimal. |

**Verdict:** Editor is **partial** — functional but monolithic, form-heavy, and several primitives are stubbed.

---

### 3. Block / section model

| Area | Finding |
|------|--------|
| **Canonical types** | `lib/cms/model/blockTypes` (BlockList, BlockNode); `lib/cms/model/blockId` (newBlockId). Editor uses local `Block` union (HeroBlock, RichTextBlock, …) in ContentWorkspace. |
| **Body format** | `{ blocks, meta }` JSON; `parseBodyToBlocks` / `serializeBlocksToBody`; body stored in `content_page_variants.body`. |
| **Registry** | `blockRegistry.ts` → `getAllBlocks()` from plugins; `plugins/coreBlocks.ts` defines types, labels, defaults, previewText. |
| **Reordering** | BlockCanvas drag-drop (onMove, onRemove, onAddAt). |

**Verdict:** Block model is **good** — typed, registry-based, reorder supported; editor block type duplicates the conceptual model.

---

### 4. Preview system (oppdatert)

| Area | Finding |
|------|--------|
| **Inline “Live” preview** | `LivePreviewPanel` inside ContentWorkspace bruker nå `renderBlock(blockToCmsBlock(block), PREVIEW_ENV, PREVIEW_LOCALE)` fra `lib/public/blocks/renderBlock`. Ingen duplisert JSX; samme pipeline som public. |
| **“Save and preview”** | Åpner `window.open(origin + '/backoffice/preview/' + selectedId)`. Route finnes: `app/(backoffice)/backoffice/preview/[id]/page.tsx` henter `content_pages`/`content_page_variants` og renderer via `renderBlock`. |
| **Tree “Preview”** | Bruker `getPreviewPathForOverlaySlug(slug)` eller `/${slug}` (public route) for overlay-sider. |
| **Public route** | `app/(public)/[slug]/page.tsx` bruker `getContentBySlug(slug)` → `parseBody(content.body)` → `renderBlock(block, ENV, LOCALE)` per blokk. Single source of truth for **public** rendering. |

**Verdict:** Preview er nå **delt pipeline** — både inline-panel, backoffice-preview og public `[slug]` bruker `renderBlock`. Draft vs. publisert variant styres av `content_page_variants` (locale/environment) og preview-ruten foretrekker `environment = 'preview'` før første tilgjengelige variant.

---

### 5. Publish / save / autosave

| Area | Finding |
|------|--------|
| **API** | GET/POST ` /api/backoffice/content/pages`; GET/PATCH `/api/backoffice/content/pages/[id]`; workflow, variant/publish, check-release. Tables: `content_pages` (id, slug, title, status, updated_at), `content_page_variants` (page_id, locale, environment, body). |
| **Save flow** | ContentWorkspace: PATCH page (title, slug, status) and variant (body). Outbox (localStorage) for offline/draft. |
| **Publish** | Workflow + variant/publish + releases; Topbar Publish/Unpublish. |
| **Draft vs published** | Status on page; variant selection by locale/environment. Public `getContentBySlug` — variant selection not fully audited here (may return “first” or prod variant). |

**Verdict:** Save/publish **good** at API level; draft vs preview semantics for **public** route need clarity.

---

### 6. Public rendering pipeline

| Area | Finding |
|------|--------|
| **Route** | `app/(public)/[slug]/page.tsx`: getContentBySlug(slug) → parseBody(content.body) → map to `renderBlock({ id, type, data }, ENV, LOCALE)`. |
| **Block renderer** | `lib/public/blocks/renderBlock.tsx` — single pipeline for hero, richText, cta, image, form, etc. |
| **Overlays** | `lib/public/blocks/renderOverlaySlot.tsx` uses same renderBlock. getOverlayByKey/getOverlayBySlug used by kitchen, driver, admin, week, dashboard, superadmin. |

**Verdict:** Public pipeline is **good** — one canonical render path; editor does **not** reuse it for preview.

---

### 7. Media / images

| Area | Finding |
|------|--------|
| **API** | `/api/backoffice/media/items`, `/api/backoffice/media/items/[id]` (referenced in docs). |
| **Editor** | MediaPickerModal is a **stub** (null). Image block uses assetPath/alt/caption (text). No first-class media library in editor. |
| **AI** | Image generate (brand_safe), image metadata improvement endpoints. |

**Verdict:** Media is **partial** — API exists; editor integration and library UX are **missing**.

---

### 8. AI (routes, components, suggestions)

| Area | Finding |
|------|--------|
| **UI** | ContentAiTools: Improve Page, SEO optimize, Generate sections, Structured intent (A/B), Layout suggestions, Block builder, Image generate, Screenshot builder, Image improve metadata. |
| **Endpoints** | POST `/api/backoffice/ai/suggest` (tools: content.maintain.page, seo.optimize.page, landing.generate.sections, experiment.generate.variants, image.*, etc.); `/api/backoffice/ai/block-builder`, `image-generator`, `image-metadata`, `layout-suggestions`, `screenshot-builder`; GET capability. |
| **Tools** | landingGenerateSections, translateBlocks, seoOptimizePage, contentMaintainPage, abGenerateVariants, imageGenerateBrandSafe, imageImproveMetadata, layoutSuggestions (deterministic), blockBuilder (buildBlockFromDescription, buildScreenshotBootstrapBlocks), registry. |
| **Apply** | Patch applied **client-side** (applyAIPatch); user saves. ai_suggestions, ai_activity_log. |
| **Full page from prompt** | Not implemented. Block builder exists. Screenshot → blocks exists. Header/footer generation not unified. Background alternatives (3–4 options per section) not implemented. |

**Verdict:** AI is **partial** — many tools and endpoints; missing full page builder, unified header/footer, and visual/background options.

---

### 9. Document / page type model

| Area | Finding |
|------|--------|
| **_stubs** | documentTypes: `{ alias: 'page', name: 'Page', allowedChildren: ['page'] }`; getDocType. |
| **DB** | content_pages (slug, title, status); content_page_variants (body, locale, environment). No explicit “document type” in schema. |

**Verdict:** **Partial** — single page type in practice; doc-type system is minimal.

---

### 10. SEO / share / meta

| Area | Finding |
|------|--------|
| **Public [slug]** | generateMetadata: title from content, canonical `/${slug}`. |
| **Editor** | No dedicated SEO tab in right panel; settings tabs are generic (scripts, advanced, etc.). |

**Verdict:** **Partial** — basic meta on public; no structured SEO panel in editor.

---

### 11. API boundaries (CMS)

| Area | Finding |
|------|--------|
| **Content** | GET/POST pages, GET/PATCH pages/[id], by-slug, home; workflow; variant/publish; check-release. |
| **Media** | items, items/[id]. |
| **AI** | suggest, block-builder, image-generator, image-metadata, layout-suggestions, screenshot-builder, capability, jobs, health. |

**Verdict:** **Good** — boundaries clear; content CRUD present (integration doc was pre-implementation).

---

### 12. Storage / data models

| Area | Finding |
|------|--------|
| **Tables** | content_pages, content_page_variants, content_workflow_state, content_releases, content_release_items, content_analytics_events, content_audit_log, ai_suggestions, ai_activity_log. Migrations: slug/title/body, locale/env, status, timestamps, seeds. |
| **Body** | JSON with `blocks` (+ meta). |

**Verdict:** **Good** — schema supports draft/publish and variants.

---

### 13. Drag-drop / reordering

| Area | Finding |
|------|--------|
| **BlockCanvas** | onMove(fromIndex, toIndex), onRemove, onAddAt; drag-drop with drop position (before/after). |

**Verdict:** **Good** — reorder supported in UI.

---

### 14. Diagnostics / dev leaks in editor

| Area | Finding |
|------|--------|
| **Support snapshot** | Copy support snapshot (rid, pageId, slug, saveStateKey) for conflict/offline/error. |
| **AI** | Capability message when AI unavailable (env vars). No heavy dev-only panels in tree. |

**Verdict:** **Acceptable** — minimal; can be tightened for “calm” UX.

---

### 15. Blockers / gaps (Umbraco-grade)

- **Tree:** Not server-backed; create/rename/move/delete not persisted.
- **Preview:** Duplicate LivePreviewPanel; “Save and preview” points to non-existent route; preview not using public render pipeline.
- **Editor:** Monolith; stubbed modals; form-heavy right panel.
- **AI:** No full page-from-prompt; no 3–4 background options per section; no unified header/footer builder.
- **Media:** No real picker or library in editor.
- **Metadata/SEO:** No dedicated Content / SEO / Share tabs.

---

## Phase 1 — Target Architecture (Summary)

### A. Content tree

- Server-backed tree as source of truth; fast load and navigation.
- Safe create/rename/move/duplicate/delete with persistence; protect system nodes (e.g. Home).
- Clear active/selected state; context actions (preview, copy link, create child).

### B. Editor surface

- **Top:** Status + save / preview / publish.
- **Center:** Block editor (same render as public where possible).
- **Right:** Tabs — Content, Extra Content, Summary, Navigation, SEO & Share, Scripts, Advanced.
- Calm, editorial hierarchy.

### C. Block-first model

- Typed block registry; schema-driven editing; reorder + insert.
- Block settings vs content fields; optional nesting rules later.
- Single block shape for storage: `{ id, type, data }`.

### D. Preview-first pipeline

- Editor preview = **same** components and pipeline as public (e.g. `renderBlock`).
- No duplicate “card” preview; optional iframe to `/[slug]` or draft preview route with same render.

### E. Public rendering

- CMS page → getContentBySlug (or draft variant) → parseBody → renderBlock per block.
- One shared component set for public and preview.

### F. AI composer layer

- Unified layer: prompt → page structure; prompt → block; header/footer; background options; image suggestions; screenshot → blocks; page improvement; SEO.
- All output typed, editable, no raw HTML dumps.

### G. Media

- Library; metadata; alt text; variants/crops; selection in blocks; future AI tagging/cropping.

### H. Publish / draft / preview

- Clear states: draft (editable); preview (draft rendered as public); published (live).
- Deterministic variant selection for public vs preview.

### I. UX

- Calm, intentional, editorial; reduce dev-facing noise.

---

## Phase 2 — Gap Analysis vs Target

| Area | Status | Notes |
|------|--------|------|
| **Tree** | GOOD | Server-backed GET `/api/backoffice/content/tree`; move via POST `.../tree/move`. Single source of truth (content_pages). |
| **Block editor** | PARTIAL | Works; monolithic; stubbed modals. Add-block flow OK (BlockPickerOverlay). |
| **Preview** | GOOD | Inline LivePreviewPanel and "Save and preview" use shared `renderBlock`; preview route `/backoffice/preview/[id]` exists. |
| **Public render pipeline** | GOOD | Single pipeline; editor reuses for preview. |
| **Publish semantics** | GOOD | Draft/publish/workflow; clarify variant for preview vs public. |
| **Metadata/settings** | PARTIAL | Many tabs but form-heavy; add clear Content / SEO / Share. |
| **AI integration** | PARTIAL | Many tools; missing full page builder, background options, header/footer. |
| **Screenshot → blocks** | PARTIAL | Endpoint exists (screenshot-builder); improve integration. |
| **Background alternatives** | MISSING | No 3–4 options per section. |
| **Header/Footer generation** | PARTIAL | Header config API; no unified AI header/footer builder. |
| **Media readiness** | PARTIAL | API + MediaPickerModal in editor (library grid, select); no full library UX. |
| **Editor UX** | PARTIAL | Functional; not yet “calm premium”; too much form feel. |

---

## Phase 3 — Implementation Plan (Phased, Small Patches)

| Phase | Focus | Rationale |
|-------|--------|-----------|
| **A** | **Shared render pipeline / real preview** | Unify editor preview with public renderBlock; fix “Save and preview” (preview by slug or draft route). Highest value, lowest risk. |
| **B** | Canonical block registry + editor flow cleanup | Already present; minor cleanup only. |
| **C** | Insert/add-block UX | BlockPickerOverlay already good; small polish. |
| **D** | AI Page Builder | Full page from prompt → editable blocks. |
| **E** | AI Block Builder | Already exists; ensure insert into editor. |
| **F** | AI visual/background alternatives | 3–4 options per section; selectable. |
| **G** | AI header/footer generation | Unify with page/block builder. |
| **H** | Screenshot-to-blocks | Strengthen integration. |
| **I** | Media v1 | Picker + library in editor. |
| **J** | Editor polish / calm UX | Hierarchy, spacing, reduce noise. |
| **K** | Publish/preview/draft hardening | Variant selection, preview route. |
| **L** | Tests / quality gates | typecheck, lint, build, sanity. |

**Order:** A → K (preview route) → then B–J as capacity allows. Phase A first.

---

## Phase 4 — Implementation Rules (Abbreviated)

- Small patches; reuse existing code; shared pipeline for preview and public.
- AI output → typed blocks, editable; no fake integration.
- Header/footer and background options: first-class, not one-off hacks.
- Preserve auth, tenancy, role guards, public routes, frozen flows.

---

## Phase 5 — Concrete Goals (Reference)

1. **Real preview** — Editor preview = real blocks, real spacing, real components (renderBlock).
2. **Better add-block** — Keep curated insert UX (already in place).
3. **AI Page Builder** — Prompt → page structure + blocks + draft copy + suggestions.
4. **AI Block Builder** — Single block from prompt; insert into page.
5. **AI visual options** — 3–4 backgrounds per section; selectable.
6. **AI header/footer** — Propose and build; integrate with global where applicable.
7. **Screenshot to blocks** — Reference image → editable layout.
8. **Page improvement AI** — Copy, structure, CTA, SEO, conversion.
9. **Editor calmness** — Premium, editorial feel.

---

## Phase 6 — Quality Gates

- typecheck, lint, build (e.g. build:enterprise); relevant tests; no dead code; clean imports.
- Migrations minimal; preserve existing data.

---

## Page AI Contract (implementert)

- **Kilde:** `lib/cms/model/pageAiContract.ts` + `docs/ai-engine/PAGE_AI_CONTRACT.md`
- **Editor-UI:** Fanen «AI & mål» (intent, CRO, lagret diagnostikk) og «SEO & deling» (SEO + social override). Alle kontraktfelter roundtrippes.
- **Persistence:** diagnostics.lastRun, diagnostics[], suggestions[] lagres ved diagnostikk og ved bruk av SEO/Improve-forslag. Se `docs/ai-engine/CONTRACT_EDITOR_UI.md`.

---

*End of audit and architecture document.*
