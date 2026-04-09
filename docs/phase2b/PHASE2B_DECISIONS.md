# Phase 2B — Canonical decisions (locked for this phase)

Aligned with project law (AGENTS.md) and user Phase 2B brief.

| ID | Decision |
|----|----------|
| D1 | **CMS is the main unit of truth** for site structure and pages; hierarchy lives on the existing `content_pages` model, not a parallel `tree_*` table. |
| D2 | **`src/components` remains the canonical component root** for shared UI; backoffice CMS may import from there; do not fork duplicate “CMS v2” trees. |
| D3 | **CMS Design scope from Phase 2A** (design tokens / scope in workspace) remains authoritative; tree and media features must not bypass or duplicate it. |
| D4 | **Preview and publish use the same render pipeline** (`CmsBlockRenderer` / public page render / shared block resolution). Phase 2B must not introduce a second renderer for “tree” or “media”. |
| D5 | **Single media pipeline:** `media_items` + storage URL + `resolveMedia` / `resolveBlockMediaDeep`. AI-sourced assets use `source = ai` (or equivalent) within the same table — no separate “AI media” product surface. |
| D6 | **No parallel models:** extend columns/APIs on existing tables and routes; no `content_tree_v2`, no duplicate block registries. |
| D7 | **Explicit non-goals for 2B:** SEO runtime, social runtime, ESG runtime, control towers, employee week truth (`weekPlan`), auth/onboarding/order/billing changes. |

---

## Phase 2B1 — Content tree implementation (2026-03-28)

| ID | Decision |
|----|----------|
| D8 | **Tree source of truth:** `content_pages` + existing tree columns and routes (`GET /api/backoffice/content/tree`, `POST /api/backoffice/content/tree/move`). |
| D9 | **Mock traces:** `getMockRoots()` no longer drives live `ContentTree`; `getMockRoots` / `getMockRoot` remain in `treeMock.ts` for tests. Local-only create/rename/delete tree mutations removed from production UI. |
| D10 | **Move/reorder:** `POST .../tree/move` with append `sort_order` from last loaded tree (`treeSortOrder` on nodes). |
| D11 | **Slug/path:** **Not** changed on move in 2B1; move updates placement columns only. |
| D12 | **Deferred:** Tree delete from UI/API wiring; sibling swap-only reorder without choosing a new parent; media library (Phase 2B2). |

---

## Phase 2B2 — Media library hardening (2026-03-28)

| ID | Decision |
|----|----------|
| D13 | **Media source of truth:** `media_items` + existing backoffice media routes + `resolveMedia` / `resolveMediaInNormalizedBlocks` / `useMediaPicker`. No parallel models or v2 files. |
| D14 | **Metadata:** `metadata.displayName` (navn), `metadata.variants` (key → https URL), plus columns `alt`, `caption`, `tags`, `mime_type`, `bytes`, `width`/`height`. |
| D15 | **Variants:** Single helper `pickResolvedUrlFromMetadata` + optional `mediaVariantKey` on block `data` for deep resolve — no second resolver. |
| D16 | **API contract:** `docs/MEDIA_API_CONTRACT.md` documents multipart `POST .../upload` and `DELETE .../items/[id]` alongside URL `POST` and `PATCH`. |
| D17 | **AI boundary:** AI-generated assets remain `media_items` rows (`source = ai`); image-metadata AI suggests alt only — same PATCH/list pipeline. |
| D18 | **Deferred to 2C+:** Tenant-scoped media RLS, dedicated variant picker UI, SEO/social/ESG/control towers — out of 2B2 scope. |
