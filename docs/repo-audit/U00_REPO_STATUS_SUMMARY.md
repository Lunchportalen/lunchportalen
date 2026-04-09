# U00 Repo Status Summary

## Scope
- Mode: READ-ONLY forensic audit.
- Screenshots in this session: none attached.
- Terminal/dev logs in this session: none attached.
- Normative comparison model: official Umbraco 17 / Bellissima documentation.
- Truth hierarchy used here: code -> runtime contracts -> migrations/schema -> docs.

## What This Repo Actually Is
Lunchportalen is a `Next.js App Router` application with three parallel but connected editorial/control layers:

1. `app/(backoffice)/backoffice/**` + `app/api/backoffice/**` + `lib/cms/**` + `components/backoffice/**`
This is the real custom CMS/backoffice plane. It owns content tree, page variants, publish/release, preview, media, governance surfaces, and Bellissima-inspired workspace chrome.

2. `studio/**`
This is a real editorial system, but it is not the same truth model as the Postgres-backed content editor. It remains a parallel editorial plane, especially around week/menu and related content operations.

3. Public/runtime surfaces
`app/(public)/**`, `app/admin/**`, `app/superadmin/**`, `app/api/orders/**`, `app/api/week/**`, `app/api/admin/**`, `app/api/superadmin/**` remain operational/runtime truth. The CMS does not replace these domains.

## What Actually Counts As CMS/Backoffice
| Surface | Exact areas | Class | Why |
|---|---|---|---|
| Content editor | `app/(backoffice)/backoffice/content/**`, `app/api/backoffice/content/**` | `ACTIVE` | This is the canonical page/tree/editor/publish workspace. |
| Backoffice shell and section model | `app/(backoffice)/backoffice/_shell/**`, `components/backoffice/**`, `lib/cms/backofficeExtensionRegistry.ts`, `lib/cms/backofficeWorkspaceContextModel.ts` | `ACTIVE` | Real shell, registry, workspace context, header/footer apps. |
| Settings / governance | `app/(backoffice)/backoffice/settings/**`, `app/api/backoffice/content/governance-*`, `lib/cms/*Document*`, `lib/cms/*Governance*`, `lib/cms/backofficeSchemaSettingsModel.ts` | `ACTIVE` | Real management/read surfaces, but mostly code-governed rather than persisted CRUD. |
| Preview / publish / releases | `app/(backoffice)/backoffice/preview/**`, `app/api/backoffice/releases/**`, `app/api/backoffice/content/pages/[id]/variant/publish/route.ts`, `lib/backoffice/content/releasesRepo.ts` | `ACTIVE` | Real delivery bridge from draft/editor to public/runtime content. |
| Media | `app/(backoffice)/backoffice/media/**`, `app/api/backoffice/media/**` | `ACTIVE` | Shared CMS asset pipeline for block editor. |
| AI editor assistance | `app/api/backoffice/ai/**`, content AI panels/hooks | `SUPPORTING` | Real and wired, but not the editor's primary truth model. |
| Sanity Studio | `studio/**` | `TRANSITIONAL` | Real editorial tooling, but parallel to the Postgres content CMS. |
| Docs | `docs/**` | `SUPPORTING` / `HISTORICAL` | Helpful only when they still match code and migrations. |

## What Only Supports CMS Indirectly
- `lib/auth/**`, `middleware.ts`, `app/api/auth/**`: control access and route posture, but do not define editor behavior.
- `lib/esg/**`, `app/api/backoffice/esg/**`, `app/backoffice/esg/**`: runtime read-models presented in backoffice, not a first-class CMS authoring subsystem.
- `lib/ai/**`, `app/api/backoffice/ai/**`: enriches editor and control plane, but does not replace page/body schema truth.
- `tests/**`, `scripts/**`, `.github/workflows/**`: operational evidence, not editor truth.

## Active, Transitional, Degraded, Broken
| Area | Verdict | Class | Why |
|---|---|---|---|
| Content tree | Live and central | `ACTIVE` | `ContentTree` + `/api/backoffice/content/tree` are real and mounted in the canonical host. |
| Tree degraded path | Honest but incomplete | `DEGRADED` | Route returns `200` + degraded payload on schema/cache drift; UX still under-surfaces operator meaning. |
| Audit log | Live but schema-sensitive | `DEGRADED` | `/api/backoffice/content/audit-log` degrades cleanly; workspace history still treats that state as secondary. |
| Content workspace core | Canonical but oversized | `ACTIVE` | `ContentWorkspace.tsx` is the real editor orchestrator. |
| Bellissima host/context | Real, not fake | `ACTIVE` | Provider, snapshot/model, header, footer apps, entity actions all exist in code. |
| `ContentWorkspaceLayout.tsx` wrapper | Compatibility layer | `TRANSITIONAL` | Comment explicitly says canonical host moved to `ContentWorkspaceHost.tsx`. |
| `_stubs.ts` | Naming drift | `MISLEADING` | It re-exports real modals plus a placeholder `Editor2Shell`; the filename suggests fake UI where real UI exists. |
| Settings section | Real but mostly explanatory | `PARTIAL` | Section chrome and collections exist, but document/data types are code-governed and not persisted CRUD objects. |
| Document types | Too thin for Bellissima parity | `STRUCTURAL_GAP` | Only one real document type (`page`) exists in code. |
| Data types | Explanatory, not managed objects | `STRUCTURAL_GAP` | `backofficeSchemaSettingsModel.ts` explains kinds; it does not persist editable data-type definitions. |
| Preview | Real and coupled to public renderer | `PARTIAL` | Preview uses the same render pipeline, but editor preview is split across several surfaces. |
| Releases | Real | `ACTIVE` | Route + repo + migration are present and wired. |
| Publish audit write | Schema-broken risk | `BROKEN` | Publish route writes `content_publish`; migrations only allow `publish`/`release_execute`/workflow values. |
| System settings | Runtime-failsafe, schema unclear | `DEGRADED` | Route handles missing `system_settings`; repo only exposes an additive `killswitch` migration in current evidence pass. |
| ESG latest monthly | Read-model drift | `DEGRADED` | Loader expects `delivered_count`/`cancelled_count`; other migrations define `delivered_meals`/`canceled_meals`. |
| Studio relationship to CMS | Parallel truth | `TRANSITIONAL` | Still editorially relevant, but not the same backoffice content model. |

## What Pretends To Be First-Class Without Actually Being First-Class
- `Document types`, `Data types`, and `Create policy` feel like managed objects in IA, but the truth is still static code under `lib/cms/**`.
- The Bellissima terminology is real in naming and UI shape, but the system is still a custom Next/React implementation, not a full Umbraco extension/runtime model.
- AI/governance/control surfaces often sit beside the editor as if they are equal editorial primitives, but many are still secondary overlays on top of the monolithic `ContentWorkspace`.
- `Settings` labels itself `First-class section`, but most of the section is `CODE_GOVERNED` read-model, not a managed schema platform.

## Top 20 Findings Right Now
1. The real CMS/backoffice is the Postgres-backed Next.js backoffice, not Sanity.
2. The repo is `CMS-led but still fragmented`, not `CMS-led and enterprise-coherent`.
3. `app/(backoffice)/backoffice/content/**` is the canonical editor plane.
4. `app/(backoffice)/backoffice/content/page.tsx` is a section landing, not the page editor itself.
5. `ContentWorkspace.tsx` remains the single biggest structural bottleneck in the editor.
6. Bellissima host/context/header/footer are real and active; this is not docs-only theater.
7. Tree-first navigation is real and mounted correctly in `ContentWorkspaceHost.tsx`.
8. Tree degrade handling is honest in API, but still under-expressed in UX.
9. Audit-log degrade handling is honest in API, but still under-expressed in workspace history UX.
10. Publish route likely breaks audit insertion because it writes `content_publish` against a stricter DB check constraint.
11. `system_settings` behavior is fail-safe in code, but current migration evidence shows additive alignment rather than a clear canonical create migration.
12. `SettingsSystemPage` reads from `/api/backoffice/settings` but saves to `/api/superadmin/system`, which is a real management boundary leak.
13. `contentDocumentTypes.ts` contains only one real document type, so Bellissima-like collections/workspaces sit on a very thin type model.
14. `backofficeSchemaSettingsModel.ts` is explanatory truth, not a persistence layer.
15. `governance-insights` is more real than much of Settings because it actually scans variants and can trigger batch normalization.
16. Preview is real and uses the public render pipeline, but preview concepts are split across inline, tab, and dedicated route surfaces.
17. Releases are real, but publish/release/audit correctness depends on fragile schema alignment.
18. `esg_monthly` is a genuine schema-drift hotspot with conflicting migration shapes and runtime expectations.
19. Old top-level audit docs drift on counts, maturity claims, and file coverage; they are no longer safe as primary truth.
20. The next build phase must start with schema/runtime correctness before any more Bellissima polish.

## Bottom Line
This repository contains a real custom CMS/control plane with serious Bellissima-inspired architecture. It is not fake, not docs-only, and not a thin overlay. But it is still `PARTIAL` against Umbraco 17/Bellissima because the editor core is monolithic, the schema/governance model is mostly static code, and several runtime/schema seams are still `DEGRADED` or `BROKEN`.
