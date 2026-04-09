# U31R File Placement Audit

## Broken Import Table

| Broken import | Importing file | Current expected file | Actual file found | Action to take |
| --- | --- | --- | --- | --- |
| `../_workspace/ContentEditor` | `app/(backoffice)/backoffice/content/page.tsx` | Section root should not import the detail editor. If detail logic were needed, the relative path would have to stay inside `content/_workspace`. | `app/(backoffice)/backoffice/content/_workspace/ContentEditor.tsx` | Remove detail-route ownership from the section root and restore `/backoffice/content` to an overview/dashboard surface. Keep `ContentEditor` canonical under `content/_workspace`. |
| `../_components/CreateMissingPageClient` | `app/(backoffice)/backoffice/content/page.tsx` | Missing-page recovery belongs to the dynamic detail route, not the section root. | `app/(backoffice)/backoffice/content/[id]/_components/CreateMissingPageClient.tsx` | Keep `CreateMissingPageClient` local to `[id]` recovery and stop importing it from the content section root. |
| Duplicate detail-route logic in section root | `app/(backoffice)/backoffice/content/page.tsx` | `app/(backoffice)/backoffice/content/page.tsx` should own overview/landing only. | `app/(backoffice)/backoffice/content/[id]/page.tsx` already owns UUID/slug editor routing. | Make `[id]/page.tsx` the only detail-route owner. Repoint the section root to the overview workspace. |

## Canonical Ownership Decision

- Canonical section overview: `app/(backoffice)/backoffice/content/page.tsx`
- Canonical detail route: `app/(backoffice)/backoffice/content/[id]/page.tsx`
- Canonical detail editor entry: `app/(backoffice)/backoffice/content/_workspace/ContentEditor.tsx`
- Canonical missing-page recovery UI: `app/(backoffice)/backoffice/content/[id]/_components/CreateMissingPageClient.tsx`

## Duplicate / Re-export Notes

- `lib/cms/backofficeNavItems.ts` is a compatibility barrel over `lib/cms/backofficeExtensionRegistry.ts`. Keep it as a thin wrapper because the command palette and tests still consume it.
- `app/(backoffice)/backoffice/content/_components/documentTypes.ts` is a thin re-export over `lib/cms/contentDocumentTypes.ts`. No new barrel should be added during U31R.
- The placement fault is not case sensitivity. It is route ownership drift plus stale relative paths in `content/page.tsx`.
