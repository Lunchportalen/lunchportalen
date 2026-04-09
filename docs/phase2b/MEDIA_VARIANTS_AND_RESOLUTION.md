# Media — variants and resolution (Phase 2B2)

## Storage

- **Primary URL:** column `media_items.url` — always the default resolved URL when no variant is requested or variant missing/invalid.
- **Optional derivatives:** `metadata.variants` — `Record<string, string>` of **https** URLs only (validated at write via `normalizeVariantsMap`; max 16 keys, key length ≤ 32).
- **No second resolver:** `pickResolvedUrlFromMetadata` in `lib/media/variantResolution.ts` is the single selection primitive; `resolveMedia` calls it after loading the row.

## Resolution order (`resolveMedia`)

1. Empty / whitespace → `null`.
2. String starts with `http://`, `https://`, or `/` → returned as-is (inline URL).
3. `cms:*` registry key → `resolvePublishedImageRef`.
4. Valid UUID → `getMediaItemById` → `pickResolvedUrlFromMetadata(primaryUrl, metadata, opts?.variantKey)`.

## Block deep resolution (`resolveMediaInNormalizedBlocks`)

- Reads `imageId` or `mediaItemId` from block `data` (and nested `steps` / `items` arrays).
- Reads optional `data.mediaVariantKey` — passed to `resolveMedia` as `{ variantKey }`.
- Fills empty `image`, `src`, `imageUrl`, `assetPath` (and dedicated hero/banner fields) with the resolved URL; **does not overwrite** non-empty URL fields.

## Safety

- Invalid variant URL → falls back to primary `url`.
- Unknown variant key → primary `url`.
- Same logic for preview and published HTML when `CmsBlockRenderer` runs server-side resolution.

## Editor / CMS Design scope

- Variants are **data-driven** from `media_items.metadata`; no separate “variant picker UI” is required for 2B2 — blocks may carry `mediaVariantKey` when product adds field to inspector (optional future).
