# Phase 2B — Changed files

## Phase 2B1 — Content tree runtime (code + docs)

### Application / library

- `app/api/backoffice/content/tree/route.ts` — `treeSortOrder` on `TreeApiNode` / `pageToNode`
- `app/api/backoffice/content/pages/route.ts` — POST accepts `tree_parent_id` / `tree_root_key`; `nextTreeSortOrder`; insert includes tree columns
- `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx` — API-backed tree, move dialog, permissions, refetch
- `app/(backoffice)/backoffice/content/_tree/ContentTreeMoveDialog.tsx` — new
- `app/(backoffice)/backoffice/content/_tree/mapTreeApiRoots.ts` — new
- `app/(backoffice)/backoffice/content/_tree/treeIds.ts` — new
- `app/(backoffice)/backoffice/content/_tree/treeTypes.ts` — extended node fields
- `app/(backoffice)/backoffice/content/_tree/treeMock.ts` — `collectDescendantIds`; mock roots retained for tests only

### Tests

- `tests/cms/mapTreeApiRoots.test.ts` — new
- `tests/api/contentPages.test.ts` — mock chains for tree placement queries

### Documentation (`docs/phase2b/`)

- `CONTENT_TREE_SOURCE_OF_TRUTH.md` — new
- `CONTENT_TREE_READ_FLOW.md` — new
- `CONTENT_TREE_WRITE_FLOW.md` — new
- `CONTENT_TREE_PATH_SAFETY.md` — new
- `CONTENT_TREE_EDITOR_RUNTIME.md` — new
- `PHASE2B_EXECUTION_LOG.md` — updated
- `PHASE2B_CHANGED_FILES.md` — this file
- `PHASE2B_DECISIONS.md` — updated (2B1 section)
- `PHASE2B_RISKS.md` — updated
- `PHASE2B_NEXT_STEPS.md` — updated

## Phase 2B2 — Media library hardening (code + docs)

### Application / library

- `lib/media/types.ts` — `MediaItemMetadata.displayName`, `variants`
- `lib/media/variantResolution.ts` — `normalizeVariantsMap`, `pickResolvedUrlFromMetadata`, `MEDIA_VARIANTS_MAX_KEYS`
- `lib/media/displayName.ts` — `getMediaDisplayName`
- `lib/media/index.ts` — re-exports
- `lib/cms/media/resolveMedia.ts` — optional `variantKey`
- `lib/cms/media/resolveBlockMediaDeep.ts` — reads `mediaVariantKey`
- `app/api/backoffice/media/items/route.ts` — POST `displayName`, `metadata.variants`
- `app/api/backoffice/media/items/[id]/route.ts` — PATCH `displayName`, merged `metadata.variants`
- `app/api/backoffice/media/upload/route.ts` — multipart `displayName` → metadata
- `app/(backoffice)/backoffice/media/page.tsx` — Mediearkiv UX (navn, search, tech line)

### Tests

- `tests/lib/media/variantResolution.test.ts` — new
- `tests/lib/media/getMediaDisplayName.test.ts` — new
- `tests/cms/resolveBlockMediaDeep.test.ts` — new
- `tests/api/mediaItemsId.test.ts` — extended

### Documentation

- `docs/MEDIA_API_CONTRACT.md` — rewritten for upload + DELETE + displayName + variants
- `docs/phase2b/MEDIA_SOURCE_OF_TRUTH.md` — new
- `docs/phase2b/MEDIA_DATA_MODEL.md` — updated (2B2)
- `docs/phase2b/MEDIA_READ_WRITE_FLOW.md` — new
- `docs/phase2b/MEDIA_VARIANTS_AND_RESOLUTION.md` — new
- `docs/phase2b/MEDIA_EDITOR_RUNTIME.md` — new
- `docs/phase2b/AI_MEDIA_BOUNDARY.md` — new
- `docs/phase2b/PHASE2B_EXECUTION_LOG.md`, `PHASE2B_DECISIONS.md`, `PHASE2B_RISKS.md`, `PHASE2B_NEXT_STEPS.md` — updated
