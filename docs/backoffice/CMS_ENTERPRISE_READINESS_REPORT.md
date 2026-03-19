# CMS Enterprise Readiness Report (Phase 2 — Verified)

**Date:** 2026-03-13  
**Scope:** Backoffice CMS capabilities verified in code after Phase 2 hardening.  
**Rule:** Only what is implemented and tested is documented. No aspirational claims.

---

## 1. CMS Capabilities Now Complete (Verified in Code)

### 1.1 Media library (enterprise-grade API)

| Capability | Verification |
|------------|--------------|
| **List** | GET `/api/backoffice/media/items` — filter by `source` (upload \| ai), `status` (proposed \| ready \| failed), `limit`/`offset`. Returns items with `id`, `url`, `alt`, `caption`, `tags`, `metadata`. Only rows with non-empty `url` returned. |
| **Create** | POST `/api/backoffice/media/items` — required `url`; optional `alt`, `caption`, `tags`. URL-based creation (no multipart upload in this API). |
| **Read** | GET `/api/backoffice/media/items/[id]` — 200 with item; 404 when not found; 400 when id empty. |
| **Update** | PATCH `/api/backoffice/media/items/[id]` — `alt`, `caption`, `tags`, `status` (with allowed transitions). 400 when no fields; 404 when not found. |
| **Delete** | DELETE `/api/backoffice/media/items/[id]` — 200 and item removed. |
| **Editor integration** | `useMediaPicker` — `applyMediaSelectionToBlock` for hero and image blocks (url, alt, mediaItemId). Media list response shape (id, url, alt) covered by tests for picker consumption. |

**Source:** `app/api/backoffice/media/items/route.ts`, `app/api/backoffice/media/items/[id]/route.ts`, `docs/MEDIA_API_CONTRACT.md`, `tests/api/mediaItems.test.ts`, `tests/api/mediaItemsId.test.ts`, `tests/cms/useMediaPickerHelpers.test.ts`.

### 1.2 SEO editing surface (complete)

| Capability | Verification |
|------------|--------------|
| **Editor surface** | `ContentSeoPanel` — edits `body.meta.seo` and `body.meta.social` via `setMeta`. Fields: title, description, canonical, noIndex, noFollow, ogImage, twitterCreator; social title/description; sitemapPriority, sitemapChangeFreq; alternativeUrl/alternativeName. Validation limits aligned with `cmsPageMetadata` (e.g. MAX_SEO_TITLE 120, MAX_META_DESCRIPTION 320). |
| **Persistence** | SEO lives in variant `body.meta`; saved with block body via PATCH variant. Public metadata built from same body in `buildCmsPageMetadata`. |
| **Public output** | `lib/cms/public/cmsPageMetadata.ts` — `buildCmsPageMetadata(pageTitle, slug, body)` reads `body.meta.seo` and `body.meta.social`; deterministic title suffix, canonical, robots, openGraph, twitter. Single source for `[slug]` generateMetadata. |
| **Round-trip** | Tests confirm envelope `{ blocks, meta: { seo, social } }` produces correct metadata; partial seo (e.g. title only) falls back correctly. |

**Source:** `app/(backoffice)/backoffice/content/_components/ContentSeoPanel.tsx`, `lib/cms/public/cmsPageMetadata.ts`, `tests/cms/cmsPageMetadata.test.ts`.

### 1.3 Release / publish workflow

| Capability | Verification |
|------------|--------------|
| **States** | Release status: `draft` → `scheduled` → `executed` (or `cancelled`). `releasesRepo`: createRelease, getRelease, listReleases, addVariantToRelease, copyVariantBodyToProd, executeRelease, updateReleaseStatus. |
| **Schedule** | POST `/api/backoffice/releases/[id]/schedule` — only when status is `draft`; accepts `publish_at`. 401 unauthenticated; 400 when not draft. |
| **Execute** | POST `/api/backoffice/releases/[id]/execute` — only when status is `scheduled`. 401 unauthenticated; 400 when not scheduled. |
| **Publish semantics** | `copyVariantBodyToProd`: preview variant body copied to prod variant; public `getContentBySlug` reads prod only. Preview edits do not change public until next publish. |

**Source:** `lib/backoffice/content/releasesRepo.ts`, `app/api/backoffice/releases/[id]/schedule/route.ts`, `app/api/backoffice/releases/[id]/execute/route.ts`, `tests/api/releasesWorkflow.test.ts`, `tests/cms/publishFlow.test.ts`.

### 1.4 Preview vs published distinction and confidence

| Capability | Verification |
|------------|--------------|
| **Published body API** | GET `/api/backoffice/content/pages/[id]/published-body` — returns prod variant body (locale nb). 401/400/404/200. Used by editor to compare draft vs published. |
| **Parity comparison** | `previewDiffersFromPublished(currentBodySerialized, publishedBody)` in `previewParity.ts` — canonical block comparison; no duplicate render logic. |
| **Live preview panel** | `LivePreviewPanel` uses same `renderBlock` as public. Shows: source label ("Kilde: Utkast"); "Ingen publisert versjon ennå" when no prod; "Avviker fra publisert versjon" when draft ≠ published; "Publisert: samme som på nettsiden" when equal. |
| **Block-level fallback** | `BlockPreviewErrorBoundary` per block — on render error shows "Kan ikke forhåndsvise denne blokken" without breaking rest of preview. |

**Source:** `app/api/backoffice/content/pages/[id]/published-body/route.ts`, `app/(backoffice)/backoffice/content/_components/previewParity.ts`, `app/(backoffice)/backoffice/content/_components/LivePreviewPanel.tsx`, `tests/cms/previewParity.test.ts`, `tests/api/contentPublishedBody.test.ts`.

### 1.5 Schema-driven editor (document types)

| Capability | Verification |
|------------|--------------|
| **Registry** | `documentTypes` array and `getDocType(alias)` in `documentTypes.ts`. Entry shape: `alias`, `name`, optional `allowedChildren` (string[]). |
| **Usage** | Create panel and envelope/document-type handling use getDocType; single source of truth for schema-driven field context. |
| **Tests** | Schema shape (alias, name, allowedChildren); getDocType returns correct entry or null; consistency with documentTypes element. |

**Source:** `app/(backoffice)/backoffice/content/_components/documentTypes.ts`, `tests/backoffice/documentTypes.test.ts`.

### 1.6 Block editor and render pipeline

| Capability | Verification |
|------------|--------------|
| **Single pipeline** | Public `[slug]` and LivePreviewPanel both use `lib/public/blocks/renderBlock`. No forked render logic. |
| **Key block types** | hero, richText, cta, image, form — all rendered in prod; form without formId shows amber message; unknown/divider in prod return null; staging shows "Ukjent blokktype" for unknown. |
| **Body format** | `{ blocks, meta }`; parseBodyToBlocks / deriveBodyForSave / serializeBlocksToBody in contentWorkspace.blocks; block order and content drive parity comparison. |

**Source:** `lib/public/blocks/renderBlock.tsx`, `tests/cms/renderBlock.test.ts`, `tests/cms/contentWorkspaceBlocks.test.ts`, `tests/cms/publicPreviewParity.test.ts`.

### 1.7 Test coverage (CMS-focused)

| Area | Location | Coverage |
|------|----------|----------|
| SEO persistence/rendering | tests/cms/cmsPageMetadata.test.ts | buildCmsPageMetadata: defaults, body.meta.seo, social, round-trip envelope, partial seo. |
| Media CRUD + editor | tests/api/mediaItems.test.ts, mediaItemsId.test.ts | List, POST, GET/PATCH/DELETE by id; caption; list shape for picker. useMediaPickerHelpers: hero/image applyMediaSelectionToBlock. |
| Release workflow | tests/api/releasesWorkflow.test.ts | Schedule 401/400/200 (draft→scheduled); Execute 401/400/200 (scheduled→execute). |
| Preview vs published | tests/cms/previewParity.test.ts, tests/api/contentPublishedBody.test.ts | previewDiffersFromPublished cases; published-body API 401/400/404/200. |
| Schema | tests/backoffice/documentTypes.test.ts | documentTypes shape; getDocType lookup. |
| Block behavior | tests/cms/renderBlock.test.ts | Unknown/staging, form with/without formId, cta, divider, hero; normalizeDisplayText. |
| Publish flow | tests/cms/publishFlow.test.ts | getContentBySlug prod only; copyVariantBodyToProd; preview edits not visible publicly. |

---

## 2. What Remains for Phase 3

- **Full AI-native page composer** — prompt → full page structure; not implemented.
- **Autonomous AI publishing** — not in scope; all publish is human-triggered.
- **CRO / experiment engine** — A/B variants, experiment endpoints referenced but not a full engine.
- **Global design-system rewrite** — UI is calm and consistent but no formal design-system package.
- **Auth/DB redesign** — unchanged; role model and tenant isolation as-is.
- **Order engine refactors** — out of scope for CMS.
- **Tree create/rename/delete in UI** — create exists in editor; tree move persisted; full Umbraco-style tree CRUD not implemented.
- **Multipart file upload for media** — media API is URL-based; upload flow is external.
- **Unified header/footer builder** — not implemented.
- **3–4 background options per section** — not implemented.

---

## 3. Deterministic vs AI-Assisted

| Component | Deterministic | AI-Assisted |
|-----------|---------------|--------------|
| **Public render** | Yes — renderBlock, buildCmsPageMetadata, getContentBySlug. | No. |
| **Preview in editor** | Yes — same renderBlock; parity comparison is canonical block diff. | No. |
| **SEO panel** | Yes — form writes to body.meta; buildCmsPageMetadata reads it. | Optional — handleAiSeoOptimize (AI) can suggest; user applies. |
| **Media list/CRUD** | Yes — API and applyMediaSelectionToBlock. | Optional — image generate/metadata endpoints; editor can use or ignore. |
| **Release schedule/execute** | Yes — state machine draft→scheduled→executed; copyVariantBodyToProd. | No. |
| **Block builder / suggestions** | Partially — layout suggestions deterministic; block builder/screenshot can be AI. | Yes — suggest, block-builder, image-generator, etc. |
| **Document types** | Yes — documentTypes and getDocType. | No. |

---

## 4. Remaining Editor Architecture Debt

- **ContentWorkspace size** — Single large component (~5k+ lines); logic split across hooks and helpers but shell remains large.
- **Block editing** — Inline forms per block type inside workspace; BlockEditModal exists but is stubbed/minimal in places.
- **MediaPickerModal** — Referenced; media picker integration is via useMediaPicker and API; dedicated modal UX may be minimal or stub.
- **Right panel tabs** — Many tabs (general, analytics, form, shop, navigation, footer, design, scripts, advanced, SEO); structure could be simplified for “1–3–1” and calm UX.
- **ContentMainShell** — Props typed as `any`; acceptable for RC but not ideal for long-term maintenance.
- **Tree** — No create/rename/delete in tree view; create and move exist elsewhere. Recycle Bin not in tree.

---

## 5. Remaining Media / SEO / Publish Limitations (Verified)

| Area | Limitation |
|------|------------|
| **Media** | No multipart upload in API; creation is URL-based. No in-app crop/variants. Filtering by tags is not enforced in list API (tags stored, filter optional in implementation). |
| **SEO** | All fields in body.meta; no separate SEO table. Sitemap generation not verified in this report. |
| **Publish** | Single locale (nb) and single environment (prod) for “published”; multi-locale/multi-env not documented as complete. Rollback is “restore from history” or re-publish; no one-click rollback API documented here. |
| **Preview** | Preview uses draft variant; “Save and preview” opens preview route — same renderBlock. No separate “preview environment” URL for external sharing. |

---

## Maturity (Phase 2 Target)

- **Before Phase 2:** ~92% (per task brief).
- **After Phase 2 (verified):** Target ~96% — credible enterprise media API, complete SEO editing surface, stronger release/publish confidence, schema-driven document types, calmer preview/publish trust, and expanded CMS test coverage. No new regressions in frozen flows; single render pipeline; fail-closed and tenant isolation preserved.

---

*Report reflects only what is present and tested in the repository as of the date above.*
