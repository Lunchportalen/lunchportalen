# Content tree — editor runtime (Phase 2B1)

## Integrated surfaces

- **Left rail:** `ContentTree` in `ContentWorkspaceLayout.tsx` — unchanged shell; inner data is now API-backed.
- **Workspace:** Opening a page still uses `/backoffice/content/[pageId]`; selection highlights UUID rows and **Hjem** when Forside id matches `targetPageId`.

## Actions

| Action | Behavior |
|--------|----------|
| Open page | Navigate to UUID route; folders toggle expand only |
| Hjem | Resolve Forside id via `/api/backoffice/content/home` |
| Opprett under | POST create with `tree_root_key` or `tree_parent_id` |
| Omdøp | PATCH title for UUID pages (not fixed kinds) |
| Flytt | Modal → POST tree/move |
| Slett | Disabled (no API in 2B1) |
| Forhåndsvis | Unchanged (`getPreviewPathForOverlaySlug` / slug) |

## Preview / publish

- No change to `CmsBlockRenderer`, variant save, or publish routes — tree affects **where** the page lives in the editor hierarchy, not block payload shape.

## CMS Design scope (Phase 2A)

- No new global design tokens or scope loaders added; tree is data + layout only inside existing backoffice chrome.

## Tests

- `tests/cms/mapTreeApiRoots.test.ts` — parse + map
- `tests/api/contentTree.test.ts` — existing API tests (move cycle, GET shape)
- `tests/api/contentPages.test.ts` — POST mock extended for tree sort query chain
