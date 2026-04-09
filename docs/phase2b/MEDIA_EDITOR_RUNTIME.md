# Media — editor runtime (Phase 2B2)

## Surfaces

| Surface | Role |
|---------|------|
| **Mediearkiv** | Full list, search (display name, URL, alt, caption, tags), URL add, file upload, per-card metadata (navn/bibliotek, alt, caption, tags), AI alt suggestion, save, delete with confirm. |
| **Content workspace** | `MediaPickerModal` + `useMediaPicker` — choose existing library item; applies UUID + URL + alt to block fields; `hasValidSelectionUrl` gates apply. |
| **Blocks** | Store `imageId` / `mediaItemId` and optional `mediaVariantKey`; inline URLs still supported for legacy. |

## Preview / publish

- **No second pipeline:** `CmsBlockRenderer` uses `resolveMediaInNormalizedBlocks` so preview and publish paths share the same resolution as production rendering when blocks are normalized the same way.
- **Design scope (2A):** Tokens and workspace chrome are unchanged; media only supplies URLs and alt/caption through existing block contracts.

## Metadata editing

- **Alt:** column `alt` + PATCH; also AI suggest endpoint writes via PATCH in flows that apply.
- **Navn (bibliotek):** `metadata.displayName` — PATCH `displayName` or merge `metadata`; list title uses `getMediaDisplayName` (displayName → caption → tag → short id).
- **Variants:** PATCH `metadata` with `variants` object; normalized server-side.

## What 2B2 does not add

- New editor shell, new picker implementation, or free-form media URLs outside API validation.
- Separate “AI media library” — AI metadata suggestions reference the same `media_items` row.
