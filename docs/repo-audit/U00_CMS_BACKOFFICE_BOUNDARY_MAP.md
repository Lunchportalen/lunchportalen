# U00 CMS / Backoffice Boundary Map

## Boundary Rule Used
Code and runtime contracts win over labels. Anything called `management`, `workspace`, `Bellissima`, or `settings` only counts as first-class when the code, route contracts, and schema say so.

## Real CMS / Backoffice Boundary
| Surface | Exact files / folders | Plane | Truth source | Class | Notes |
|---|---|---|---|---|---|
| Content section shell | `app/(backoffice)/backoffice/content/layout.tsx`, `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceHost.tsx`, `app/(backoffice)/backoffice/_shell/SectionShell.tsx` | Management | React route + shared workspace snapshot | `ACTIVE` | This is the real entry point for the editor section. |
| Content tree | `app/(backoffice)/backoffice/content/_tree/**`, `app/api/backoffice/content/tree/**`, `lib/cms/contentTreeRoots.ts` | Management | DB-backed `content_pages` + virtual roots | `ACTIVE` | Primary navigation for content entities. |
| Page editor | `app/(backoffice)/backoffice/content/[id]/page.tsx`, `app/(backoffice)/backoffice/content/_workspace/ContentEditor.tsx`, `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | Management | Page/variant body + editor state | `ACTIVE` | Direct editing surface. |
| Governance + schema settings | `app/(backoffice)/backoffice/settings/**`, `lib/cms/contentDocumentTypes.ts`, `lib/cms/blockAllowlistGovernance.ts`, `lib/cms/backofficeSchemaSettingsModel.ts` | Management | Static code registry | `CODE_GOVERNED` | Reads like managed schema, but deploy-time code still owns truth. |
| Releases | `app/api/backoffice/releases/**`, `lib/backoffice/content/releasesRepo.ts` | Management -> Delivery bridge | `content_releases`, `content_release_items`, `content_page_variants` | `ACTIVE` | Explicit publish orchestration. |
| Preview | `app/(backoffice)/backoffice/preview/[id]/page.tsx`, `app/api/backoffice/content/pages/[id]/published-body/route.ts`, `PreviewCanvas`, `LivePreviewPanel` | Management / delivery-adjacent | Same render pipeline as public | `PARTIAL` | Real preview, but conceptually split across multiple editor surfaces. |
| Media | `app/(backoffice)/backoffice/media/**`, `app/api/backoffice/media/**` | Management | `media_items` + upload pipeline | `ACTIVE` | Shared asset layer for blocks/editor. |
| Public content delivery | `app/(public)/[slug]/page.tsx`, `lib/cms/public/**`, `components/cms/**` | Delivery | Published `content_page_variants` | `RUNTIME_TRUTH` | This is where content becomes customer-facing. |
| Sanity Studio | `studio/**` | Parallel editorial | Sanity datasets | `TRANSITIONAL` | Real editorial system, not same CMS truth as `content_pages`. |
| Runtime/admin/superadmin domains | `app/admin/**`, `app/superadmin/**`, `app/api/admin/**`, `app/api/superadmin/**`, `app/api/order/**`, `app/api/orders/**`, `app/api/week/**` | Delivery / operations | Domain tables and RPCs | `RUNTIME_TRUTH` | CMS does not replace these domain truths. |

## Which Repo Areas Actually Talk To CMS
| Domain | How it touches the CMS | Exact link | Class |
|---|---|---|---|
| Public website | Reads published page bodies | `getContentBySlug()` -> `content_pages` + `content_page_variants` | `ACTIVE` |
| Backoffice preview | Reads draft/preview body via same renderer | `app/(backoffice)/backoffice/preview/[id]/page.tsx` | `ACTIVE` |
| Media | Provides assets to blocks/editor forms | `MediaPickerModal`, media APIs, `media_items` | `ACTIVE` |
| AI editor tools | Suggests or mutates editor state, logs events | `app/api/backoffice/ai/**`, `useContentWorkspaceAi.ts`, `contentWorkspace.aiRequests.ts` | `SUPPORTING` |
| Releases | Publishes variants into prod delivery contract | `releasesRepo.ts`, variant publish route | `ACTIVE` |
| ESG backoffice | Reads runtime ESG rollups inside backoffice shell | `app/api/backoffice/esg/latest-monthly/route.ts` | `INDIRECT_CMS` |
| System settings | Uses backoffice settings UI, but writes through superadmin runtime route | `settings/system/page.tsx` -> `/api/backoffice/settings` + `/api/superadmin/system` | `LEAKY` |
| Week/menu | Shares backoffice shell language, but truth remains outside page CMS | `studio/**`, week/menu runtime routes | `STRUCTURAL_GAP` |

## Management vs Delivery Split That Is Actually True
| Area | Real plane | Why |
|---|---|---|
| Content tree / editor / settings / governance / releases / preview controls | Management | Used by superadmin to author, validate, publish, or inspect. |
| Public slug rendering | Delivery | Customer-facing, published-only consumption. |
| Orders, week, kitchen, driver, agreements, billing | Delivery / runtime | Transactional truth stays outside page CMS. |
| Sanity week/menu authoring | Parallel editorial | Not the same object model or publish path as `content_pages`. |

## Where The Boundary Leaks
| Leak | Evidence | Class | Why it matters |
|---|---|---|---|
| Settings system page saves outside backoffice settings API | `app/(backoffice)/backoffice/settings/system/page.tsx` saves to `/api/superadmin/system` | `STRUCTURAL_GAP` | The management section is not fully self-contained. |
| Preview is both tab, inline panel, and dedicated route | `ContentWorkspaceMainCanvas.tsx`, `LivePreviewPanel.tsx`, `PreviewCanvas.tsx`, `app/(backoffice)/backoffice/preview/[id]/page.tsx` | `PARTIAL` | Multiple preview concepts dilute a single workspace mental model. |
| Governance reads like CRUD but is static code | `backofficeSchemaSettingsModel.ts`, `contentDocumentTypes.ts`, Settings pages | `CODE_GOVERNED` | Users see collections/workspaces that do not yet correspond to managed persisted objects. |
| Bellissima language exceeds actual extension runtime | `backofficeExtensionRegistry.ts`, Bellissima workspace model/context | `UX_PARITY_ONLY` | IA is inspired by Umbraco, but extension/runtime parity is not there yet. |
| Sanity and page CMS still coexist | `studio/**` plus `content_pages` stack | `TRANSITIONAL` | Editorial truth is still split by domain. |

## Boundary Judgment
The real system boundary is not “all backoffice pages”. The real CMS boundary is the Postgres-backed content, preview, publish, release, media, and governance stack inside the backoffice shell. Everything else either supports that layer, consumes its output, or remains a separate runtime/editorial system.
