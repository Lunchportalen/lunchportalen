# AI media boundary (Phase 2B2)

## Principle

**All durable image assets — including AI-generated — are rows in `media_items` with `source = 'ai'` or `source = 'upload'`.** There is no parallel AI asset store in this phase.

## Existing hooks (inventory)

| Mechanism | Role |
|-----------|------|
| **`source` column** | Distinguishes provenance (`upload` vs `ai`) for audit and UI badges; same schema. |
| **`POST /api/backoffice/ai/image-metadata`** | Suggests improved alt text; Mediearkiv and editor call it with `mediaItemId` + `url` — **does not** create a separate media pipeline. |
| **Future generation flows** | Must insert/update `media_items`, return UUID to the editor, and reuse `GET`/`PATCH`/picker — **no new “AI bucket” product path** without an explicit later phase. |

## Consolidation rules

1. **Land in library:** New AI-generated binaries must be uploaded (storage or URL) and registered like any other item.
2. **Same metadata contract:** `alt`, `caption`, `tags`, `metadata.displayName`, `metadata.variants` apply equally.
3. **Same resolution:** `resolveMedia` / `resolveBlockMediaDeep` — no AI-specific resolver.

## Out of scope for 2B2

- Building new image generation engines or batch AI ingest.
- Control towers, SEO/social/ESG runtimes (deferred per phase boundaries).
