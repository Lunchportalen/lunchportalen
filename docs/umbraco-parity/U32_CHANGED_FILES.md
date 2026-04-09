# U32 Changed Files

Status: executed with real runtime changes

If this phase had ended as docs-only, that would have been a failure. It did not. U32 changed runtime code, tests, and the parity documentation pack.

| File / area | Why | Minimal risk reason |
| --- | --- | --- |
| `app/(backoffice)/backoffice/content/layout.tsx` | Mount the canonical content host directly at section level | Content scope only; no auth/runtime truth moved |
| `app/(backoffice)/backoffice/content/page.tsx` | Restore `/backoffice/content` as the canonical content-first landing | Root landing only; detail route remains canonical for editing |
| `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceHost.tsx` | Introduce one canonical section host for landing, tree, and workspace composition | Consolidates existing layers instead of adding a second editor |
| `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceLayout.tsx` | Reduce older wrapper to a compatibility layer | Keeps imports stable while removing host ambiguity |
| `app/(backoffice)/backoffice/content/_workspace/ContentSectionLanding.tsx` | Publish section-level workspace posture and make create/settings flows explicit | Reuses existing APIs and routes |
| `app/(backoffice)/backoffice/content/_workspace/MainViewContext.tsx` | Route old view helpers through the canonical Bellissima context | Removes split view truth without deleting compatibility too early |
| `components/backoffice/ContentBellissimaWorkspaceContext.tsx` | Turn the provider into a real shared workspace context with active view and action handlers | Extends the live model instead of creating a parallel one |
| `lib/cms/backofficeWorkspaceContextModel.ts` | Define the canonical snapshot/model for views, actions, footer apps, entity actions, history, and runtime posture | One typed model extended in place, no new engine |
| `components/backoffice/BellissimaWorkspaceHeader.tsx` | Render section/entity status, actions, and view tabs from the shared model | Reuses existing header surface |
| `components/backoffice/BackofficeWorkspaceFooterApps.tsx` | Make footer apps persistent and model-driven for both section and entity scope | Footer surface already existed; this removes duplication |
| `components/backoffice/BellissimaEntityActionMenu.tsx` | Reuse one entity action menu pattern across workspace surfaces | Structural reuse only; no new mutation layer |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | Publish the real entity workspace snapshot and action handlers from the editor runtime | Keeps editor business logic local while unifying workspace identity |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceEditorModeStrip.tsx` | Remove fake top-level workspace-view ownership | Clarifies scope instead of changing editor business rules |
| `app/(backoffice)/backoffice/content/_components/ContentTopbar.tsx` | Stop duplicating publish/unpublish actions outside the canonical model | Existing save/publish flow preserved |
| `app/(backoffice)/backoffice/content/_components/ContentSaveBar.tsx` | Render model-driven actions when available | Falls back safely when the model is absent |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceWorkspaceShell.tsx` | Rebalance the canonical tri-pane workspace layout | Layout-only change inside content editor shell |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceMainCanvas.tsx` | Widen the preview split and clarify edit-surface posture | Editor state and persistence logic unchanged |
| `app/(backoffice)/backoffice/content/_components/RightPanel.tsx` | Group inspector/runtime surfaces more clearly | UI grouping only; no auth or data-contract change |
| `app/(backoffice)/backoffice/content/_tree/NodeActionsMenu.tsx` | Align tree action labels with shared workspace language | Tree permissions remain fail-closed |
| `app/api/backoffice/content/tree/route.ts` | Return sharper degraded operator posture for tree failures | Existing API contract preserved |
| `app/(backoffice)/backoffice/content/_tree/mapTreeApiRoots.ts` | Surface the new tree operator message in UI-facing parsing | Read-model only; no new data source |
| `app/api/backoffice/content/audit-log/route.ts` | Distinguish table missing, schema cache, and column-missing degraded states more honestly | Existing degraded-200 posture preserved |
| `lib/cms/backofficeExtensionRegistry.ts` | Expand settings workspace views and keep section/workspace metadata explicit | Registry-only control-plane change |
| `app/(backoffice)/backoffice/settings/_components/SettingsSectionChrome.tsx` | Drive settings chrome from shared collection/workspace metadata | Management-only surface; no fake CRUD added |
| `tests/backoffice/content-page-smoke.test.tsx` | Lock the content-first landing posture | Focused UI smoke coverage |
| `tests/cms/bellissimaWorkspaceContext.test.ts` | Lock the shared Bellissima model for section and entity scope | Focused model coverage |
| `tests/cms/backofficeWorkspaceContextModel.test.ts` | Update snapshot/model assertions to the real U32 contract | Test-only, no runtime impact |
| `tests/cms/backofficeExtensionRegistry.test.ts` | Lock settings workspace view expansion | Registry-only regression coverage |
| `tests/cms/mapTreeApiRoots.test.ts` | Lock tree degraded operator messaging | Parser-only regression coverage |
| `tests/api/contentAuditLogRoute.test.ts` | Lock honest degraded audit classification and serialization | Route-only regression coverage |

## Risk rule

- Only minimal diffs were made in existing canonical files.
- No auth, onboarding, billing, ordering, or frozen superadmin/system truths were changed.
- No parallel editor, tree, settings, or history engine was introduced.
