# CMS design merge rules (Phase 2A)

## Order (locked)

```
global → page → section → block (mergeFullDesign)
```

1. **Global:** `settings.data` from published `global_content` key `settings`, field `designSettings`.
2. **Page:** `meta.pageDesign` on the page body (same document shape as inner `designSettings`).
3. **Section:** `meta.sectionDesign[sectionId]` when `block.config.sectionId` is set.
4. **Block:** `mergeFullDesign(block.config, effectiveParsedDesignSettings, blockType)` — block-level tokens (theme, layout, card, surface, spacing, typography, container) override the effective parsed layer **per field** as in `designContract.ts`.

## Implementation

- Single function: `buildEffectiveParsedDesignSettingsLayered(globalDataRoot, pageMeta, sectionId)` in `lib/cms/design/designContract.ts`.
- Uses `mergeDesignSettingsIntoGlobalContentData` twice (page patch, then section patch) so **card / nested keys** follow the same merge rules as global CMS saves.

## Conflict resolution

- **Later layer wins** for overlapping keys in the `designSettings` document (e.g. `surface.section` from section replaces page if both set).
- **Block** always wins over effective global/page/section for fields present in `mergeFullDesign` (surface, spacing, typography, container width, card, theme, layout).

## Where used

| Surface | Mechanism |
|---------|-----------|
| Published `[slug]` / `home` | `CmsBlockRenderer` + `getGlobalSettingsDataRoot` + `pageCmsMeta` from `loadLivePageContent` |
| Backoffice preview `[id]` | Same `CmsBlockRenderer` + `parseBodyMeta(body)` |
| Live preview / `PublicPageRenderer` | Fetch `/api/content/global/settings` → full `data` root + `pageCmsMeta` prop + same `buildEffectiveParsedDesignSettingsLayered` per block |

No second merge implementation: one exported merge for parsed effective settings; block merge remains `mergeFullDesign`.
