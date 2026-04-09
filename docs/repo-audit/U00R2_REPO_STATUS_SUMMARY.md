# U00R2 Repo Status Summary

## Scope
- Mode: READ-ONLY forensic audit.
- Screenshots in this session: none attached.
- Terminal/dev logs in this session: none attached.
- Normative comparison model: official Umbraco 17 / Bellissima documentation for extension types, workspaces, collections, global context, property editor schema/UI, property value presets, Management API, and Content Delivery API.
- Truth hierarchy used here: code -> runtime contracts -> migrations/schema -> docs.

## What This Repo Actually Is
Lunchportalen is a `Next.js App Router` monorepo-shaped application with one real custom CMS/backoffice plane, one parallel Sanity editorial plane, and many runtime/operations planes that the CMS does not replace.

1. `app/(backoffice)/backoffice/**` + `app/api/backoffice/**` + `lib/cms/**` + `components/backoffice/**`
This is the real custom CMS/backoffice. It owns the page tree, page variants, publish/release flows, editor workspace, governance read models, media access, and Bellissima-inspired shell chrome.

2. `studio/**`
This is a real editorial system, but it is not the same content truth as `content_pages` / `content_page_variants`. It remains a parallel truth for menu/week and related editorial surfaces.

3. Runtime planes
`app/(public)/**`, `app/admin/**`, `app/superadmin/**`, `app/kitchen/**`, `app/driver/**`, `app/api/orders/**`, `app/api/week/**`, `app/api/admin/**`, `app/api/superadmin/**` remain operational/runtime truth. The CMS surfaces inspect or support these; they do not replace them.

## What Actually Counts As CMS/Backoffice
| Surface | Exact areas | Lifecycle class | Why |
|---|---|---|---|
| Content editor | `app/(backoffice)/backoffice/content/**`, `app/api/backoffice/content/**` | `ACTIVE` | Canonical page/tree/editor/publish workspace. |
| Backoffice shell and section model | `app/(backoffice)/backoffice/_shell/**`, `components/backoffice/**`, `lib/cms/backofficeExtensionRegistry.ts`, `lib/cms/backofficeWorkspaceContextModel.ts` | `ACTIVE` | Real shell, registry, workspace context, header, entity actions, footer apps. |
| Settings and governance | `app/(backoffice)/backoffice/settings/**`, `app/api/backoffice/content/governance-*`, `lib/cms/contentDocumentTypes.ts`, `lib/cms/blockAllowlistGovernance.ts`, `lib/cms/backofficeSchemaSettingsModel.ts` | `ACTIVE` | Real management/read surfaces, but largely `CODE_GOVERNED`. |
| Preview, publish, releases | `app/(backoffice)/backoffice/preview/**`, `app/api/backoffice/releases/**`, `app/api/backoffice/content/pages/[id]/variant/publish/route.ts`, `lib/backoffice/content/releasesRepo.ts` | `ACTIVE` | Real bridge from editor state to public delivery truth. |
| Media | `app/(backoffice)/backoffice/media/**`, `app/api/backoffice/media/**` | `ACTIVE` | Shared asset pipeline for block/page editing. |
| CMS globals | `app/api/content/global/**`, `supabase/migrations/20260421000000_global_content.sql`, `lib/cms/readGlobal.ts`, `lib/cms/writeGlobal.ts` | `ACTIVE` | Separate persisted global header/footer/settings truth used by preview and marketing surfaces. |
| AI editorial/control support | `app/api/backoffice/ai/**`, editor AI panels, `lib/ai/**` | `SUPPORTING` | Real and wired, but not the primary schema/content truth. |
| Sanity Studio | `studio/**` | `TRANSITIONAL` | Real editorial tooling, but parallel to the Postgres-backed page CMS. |
| Docs | `docs/**` | `SUPPORTING` / `HISTORICAL` | Useful only when still aligned with code and migrations. |

## What Only Supports CMS Indirectly
| Area | Exact files/dirs | Lifecycle class | Why |
|---|---|---|---|
| Auth and route posture | `middleware.ts`, `lib/auth/**`, `app/api/auth/**` | `SUPPORTING` | Controls access posture, not editor behavior. |
| Social plane | `app/api/social/**`, `lib/social/**` | `SUPPORTING` | Content-adjacent growth runtime; not the page CMS core. |
| Cron and jobs | `app/api/cron/**`, `vercel.json`, `.github/workflows/**` | `SUPPORTING` | Operational scheduling around CMS/runtime side effects. |
| Styles and theme | `app/globals.css`, `lib/design/tokens.ts`, `lib/ui/tokens.ts`, `lib/ui/motionTokens.ts`, `lib/theme/ThemeProvider.tsx` | `SUPPORTING` | Shapes backoffice/editor behavior, spacing, modal feel, preview framing, and theme state. |
| Public assets | `public/**`, especially `public/brand/**` | `SUPPORTING` | Affects public render/preview and shell branding, not schema truth. |
| ESG read models | `lib/esg/**`, `app/api/backoffice/esg/**`, `app/api/admin/esg/**` | `SUPPORTING` | Runtime rollups surfaced in backoffice, not a first-class authoring subsystem. |
| Tests and scripts | `tests/**`, `scripts/**` | `SUPPORTING` | Evidence and safety net, not content truth. |

## Active, Half-Finished, Degraded, Broken
| Area | Verdict | Classification | Why |
|---|---|---|---|
| Content tree | Live and central | `ACTIVE` | `ContentTree.tsx` + `/api/backoffice/content/tree` are real and mounted in the canonical host. |
| Tree degraded path | Honest but incomplete | `DEGRADED` | Route returns degraded payloads on schema/cache drift, but workspace UX still under-surfaces the operator meaning. |
| Audit log | Live but schema-sensitive | `DEGRADED` | `/api/backoffice/content/audit-log` degrades safely, yet history UX still treats degraded truth as secondary. |
| Content workspace core | Canonical but oversized | `ACTIVE` | `ContentWorkspace.tsx` is the real editor orchestrator. |
| Bellissima host/context layer | Real, not theater | `ACTIVE` | Provider, snapshot/model, view tabs, footer apps, and entity actions all exist in code. |
| Quick-add vs rich block picker | Two live flows, not one system | `TRANSITIONAL` | `BlockAddModal.tsx` and `BlockPickerOverlay.tsx` both solve discovery, but with different models and UX weight. |
| Settings section | Real but mainly explanatory | `PARTIAL` | Section chrome and collection/workspace IA are real, but most schema/type truth is static code. |
| Document types | Too thin for Bellissima parity | `STRUCTURAL_GAP` | `contentDocumentTypes.ts` exposes only one real document type: `page`. |
| Data types | Descriptive, not managed objects | `STRUCTURAL_GAP` | `backofficeSchemaSettingsModel.ts` explains field kinds; it does not persist editable Data Types. |
| Property-editor-like UI | Strongest near-parity surface | `PARTIAL` | `SchemaDrivenBlockForm.tsx` and `blockFieldSchemas.ts` are real, but still static TypeScript governance. |
| Preview | Real and public-renderer-coupled | `PARTIAL` | Preview uses the public pipeline, but the concept is split across inline panel, workspace view, and dedicated route. |
| Releases | Real | `ACTIVE` | Route + repo + migration are present and wired. |
| Publish audit write | Schema-broken risk | `BROKEN` | Publish route writes `content_publish`; migrations only allow `publish` and related values. |
| System settings | Runtime-failsafe, baseline unclear | `DEGRADED` | Backoffice route handles missing `system_settings`, but migration evidence is additive, not clean baseline proof. |
| ESG latest monthly | Read-model drift | `DEGRADED` | Loader expects `delivered_count`/`cancelled_count`; older migrations define `delivered_meals`/`canceled_meals`. |
| Global content | Real but separate from page CMS | `ACTIVE` / `STRUCTURAL_GAP` | `global_content` is persisted and used, but not integrated as Bellissima-managed entities. |
| Studio vs Postgres relationship | Parallel truth | `TRANSITIONAL` | Both are real; they are not one coherent CMS model yet. |

## What Pretends To Be First-Class Without Actually Being First-Class
- `Document types`, `Data types`, and `Create policy` look like managed objects in IA, but the real truth is static code under `lib/cms/**`.
- The Bellissima vocabulary is not fake, but the implementation is still a custom Next/React system, not a real Umbraco extension runtime with manifests, extension loading, and platform-level scoping.
- `Settings` reads like a full management section, but much of it is `CODE_GOVERNED` explanation rather than persisted management objects.
- `Global` and `Design` read like first-class workspace views, but their truth still lives inside editor state, special sections, and global content routes rather than one normalized workspace platform.

## Top 25 Findings Right Now
1. The real CMS/backoffice is the Postgres-backed Next.js backoffice, not Sanity.
2. The repo remains `CMS-led but still fragmented`.
3. `app/(backoffice)/backoffice/content/**` is the canonical editor plane.
4. `components/backoffice/ContentBellissimaWorkspaceContext.tsx` and `lib/cms/backofficeWorkspaceContextModel.ts` prove the Bellissima-like model is real, not docs-only theater.
5. `lib/cms/backofficeExtensionRegistry.ts` proves the registry is manifest-like, but still static code rather than an extension runtime.
6. `ContentWorkspace.tsx` remains the single biggest structural bottleneck in the editor.
7. Tree-first navigation is real and mounted correctly in `ContentWorkspaceHost.tsx`.
8. Tree degrade handling is honest in API, but still under-expressed in UX.
9. Audit-log degrade handling is honest in API, but still under-expressed in workspace history UX.
10. The publish route likely breaks audit insertion because it writes `content_publish` against a stricter DB check constraint.
11. `system_settings` behavior is fail-safe in code, but current migration evidence still does not show a clean canonical table-creation baseline in this pass.
12. `SettingsSystemPage` reads from `/api/backoffice/settings` but writes through `/api/superadmin/system`, which is a real management boundary leak.
13. `contentDocumentTypes.ts` contains only one real document type, so Bellissima-like collections/workspaces sit on a very thin type model.
14. `backofficeSchemaSettingsModel.ts` is explanatory truth, not a persistence layer.
15. `SchemaDrivenBlockForm.tsx` is the strongest property-editor-like surface in the repo, but it is still driven by static TypeScript schemas.
16. `BlockAddModal.tsx` and `BlockPickerOverlay.tsx` are both active, which means block discovery is still split-brain.
17. Preview is real and uses the public render pipeline, but preview meaning is split across inline panel, workspace view, and dedicated route.
18. `global_content` is a real persisted CMS truth for header/footer/settings, but it lives beside the page CMS rather than inside one unified content model.
19. `PreviewCanvas.tsx`, `GlobalDesignSystemSection.tsx`, and `SocialGrowthLocationSection.tsx` prove that editor-adjacent surfaces already depend on `/api/content/global/settings`.
20. Releases are real, but publish/release/audit correctness depends on fragile schema alignment.
21. `esg_monthly` remains a genuine schema-drift hotspot with conflicting migration shapes and runtime expectations.
22. `app/globals.css`, token files, and `ThemeProvider.tsx` materially shape editor calmness, modal behavior, and preview framing; styles are part of CMS evidence here, not decoration.
23. Old top-level audit docs still compete as “truth,” which creates document drift and bad prioritization.
24. No code evidence proves real `entityBulkAction`, `entityCreateOptionAction`, or `globalContext` parity for the CMS workspace platform.
25. The next build phase must start with schema/runtime correctness before any more Bellissima polish.

## Brutal Totaldom
This repository contains a real custom CMS/control plane with serious Bellissima-inspired structure. It is not fake, not docs-only, and not a thin overlay. But it is still `PARTIAL`, with multiple `STRUCTURAL_GAP` zones and a few concrete `BROKEN` / `DEGRADED` seams. The repo currently reads as `CMS-led but still fragmented`, and it is still `not coherent enough yet` to claim anything close to `near-Umbraco-17 parity`.
