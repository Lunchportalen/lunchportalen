# Editor–AI capability model

**Purpose:** AI capabilities exposed in the editor are clear, consistent, and correctly wired. Each editor action maps to one capability; page-level tools use page truth, block-level tools use block truth; no misleading or unfinished tools are exposed.

## 1. Single source of truth for tool IDs

- **Registry:** `lib/ai/tools/registry.ts` defines:
  - **AI_TOOL_IDS** — tools that go through **POST /api/backoffice/ai/suggest** (content.maintain.page, seo.optimize.page, landing.generate.sections, experiment.generate.variants, image.generate.brand_safe, image.improve.metadata, i18n.translate.blocks). Policy (role, rate limit, patch) is enforced there.
  - **EDITOR_ONLY_TOOL_IDS** — tools served by **dedicated routes** (block.builder, page.builder, screenshot.builder, layout.suggestions). Not in suggest; have their own API routes.
- **Editor:** Uses **EditorToolId** = ToolId | EditorOnlyToolId for busy state and for mapping to metrics/features. No ad-hoc tool strings in the editor.

## 2. Editor tool list and wiring

| Editor surface | Action | Tool ID | Route / handler | Scope |
|----------------|--------|--------|------------------|--------|
| ContentAiTools | Improve Page | content.maintain.page | POST /api/backoffice/ai/suggest | Page (blocks + meta) |
| ContentAiTools, ContentSeoPanel | SEO optimize | seo.optimize.page | POST /api/backoffice/ai/suggest | Page (blocks + meta) |
| ContentAiTools | Generate sections | landing.generate.sections | POST /api/backoffice/ai/suggest | Page (existing blocks) |
| ContentAiTools, BlockInspectorShell | Structured intent (A/B) | experiment.generate.variants | POST /api/backoffice/ai/suggest | Page (blocks) |
| ContentAiTools | Hent layoutforslag | layout.suggestions | POST /api/backoffice/ai/layout-suggestions | Page (blocks + title/slug) |
| ContentAiTools | Block builder + Insert | block.builder | POST /api/backoffice/ai/block-builder | Block (description → one block) |
| ContentAiTools | Page builder + Replace/Append | page.builder | POST /api/backoffice/ai/page-builder | Page (prompt/options → blocks) |
| ContentAiTools | Screenshot builder + Replace/Append | screenshot.builder | POST /api/backoffice/ai/screenshot-builder | Page (screenshot/description → blocks) |
| ContentAiTools | AI image generate | image.generate.brand_safe | POST /api/backoffice/ai/image-generator | Media (topic/purpose → url/id) |
| ContentAiTools | Image improve metadata | image.improve.metadata | POST /api/backoffice/ai/image-metadata | Block/media (mediaItemId/url) |
| ContentAiTools | Kjør sidediagnostikk | — | Runs improve + SEO (suggest x2) | Page |

- **i18n.translate.blocks** is in the registry and supported by the suggest route but **not exposed** in the editor UI. So we do not show a misleading or unfinished translate tool.

## 3. Tool → feature mapping (metrics/errors)

- **contentWorkspace.ai.ts** exports **AI_TOOL_TO_FEATURE**: every editor-exposed tool ID maps to an **EditorAiFeature** (improve_page, seo_optimize, generate_sections, structured_intent, page_builder, block_builder, screenshot_builder, layout_suggestions, image_generate, image_metadata, etc.). Used for logging (ai_error, ai_result_received, ai_patch_applied) so capability is consistent and observable.
- **EditorAiFeature** (domain/backoffice/ai/metrics/editorAiMetricsTypes.ts) includes all features used by editor tools; no dangling or duplicate names.

## 4. Page-level vs block-level

- **Page-level (operate on page truth):** Improve Page, SEO optimize, Generate sections, Structured intent, Layout suggestions, Page builder, Screenshot builder. They use **effectiveId**, current **blocks**, **meta**, **title**, **slug** from the open page. Request body includes pageId and page context; apply is to the current page.
- **Block-level:** Block builder (description → one block; user chooses where to insert). Hero image suggestion (per-block: one hero block + media suggestions). Image improve metadata (one media item). They use **blockId** or **mediaItemId** or insert index as needed; no confusion with page-level.

## 5. Capability gate and availability

- **Gate:** GET /api/backoffice/ai/capability returns **enabled**. Editor derives **aiCapability** (loading | available | unavailable) and **aiDisabled** (when offline, no page, or capability !== available). All AI tools in ContentAiTools are disabled when **disabled** (or aiDisabled) is true.
- **Availability:** When capability is "available", all exposed tools are available in the UI. When "unavailable", tools are disabled and the panel explains configuration (e.g. OPENAI_API_KEY). No tool is shown as available when the backend cannot run it (capability reflects actual implementation gate).

## 6. Duplication and consistency

- **SEO** appears in two places: ContentAiTools (card "SEO optimize side") and ContentSeoPanel (inline "Generer SEO-forslag"). Both call the **same** handler and **same** tool (seo.optimize.page). Same capability, two surfaces; no inconsistent wiring.
- **Structured intent** appears in ContentAiTools and BlockInspectorShell (hero/CTA). Same tool (experiment.generate.variants); handlers may pass different options (e.g. fromPanel vs hero_inline/cta_inline). One capability, consistent tool ID.

## 7. Unsupported / partial tools

- **i18n.translate.blocks** is implemented in the suggest route but **not** exposed in the editor. So we do not show a translate action that would be misleading or half-done in the UI.
- Every **exposed** tool has a working handler and route; tool availability matches implementation. No fake or placeholder surfaces.

## 8. Summary

| Principle | Implementation |
|-----------|----------------|
| One action → one capability | Each button/action uses one tool ID; handler calls one API route. |
| No duplicate capability semantics | Same tool ID and handler for SEO in both panel and inline; structured intent same tool, options vary. |
| Page-level on page truth | effectiveId, blocks, meta, title, slug; pageId in request; apply to current page. |
| Block-level on block truth | blockId, insert index, or mediaItemId where relevant. |
| Unsupported not exposed | i18n.translate.blocks not in editor UI. |
| Availability matches implementation | aiCapability from GET capability; all tools disabled when unavailable. |
| Consistent tool → feature | AI_TOOL_TO_FEATURE maps every editor tool to an EditorAiFeature for metrics/errors. |
