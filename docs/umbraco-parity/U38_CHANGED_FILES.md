# U38 Changed Files

Kode er endret i U38. Under er de sentrale filene som faktisk bærer fasen.

| File | Why | Minimal risk rationale |
| --- | --- | --- |
| `lib/cms/backofficeSchemaSettingsModel.ts` | Added canonical property-editor flow helpers for document types and kinds. | Read-model extension only; no runtime write path introduced. |
| `app/(backoffice)/backoffice/settings/document-types/[alias]/page.tsx` | Turned document-type detail into a management-flow workspace. | UI reads from existing governance model; no contract change. |
| `app/(backoffice)/backoffice/settings/data-types/[kind]/page.tsx` | Turned data-type detail into a management-flow workspace. | UI-only surface over existing models. |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspacePropertiesRail.tsx` | Exposed “what drives this editor” inside the workspace. | Read-only governance rail; no editing semantics changed. |
| `lib/cms/backofficeWorkspaceContextModel.ts` | Added management/schema/governance actions and footer shortcut. | Centralized model change with focused tests. |
| `lib/cms/backofficeExtensionRegistry.ts` | Derived settings workspace views from canonical settings collections. | Removed duplication instead of adding new behavior. |
| `app/(backoffice)/backoffice/settings/_components/SettingsSectionChrome.tsx` | Consumed canonical settings workspace views. | Navigation source aligned with registry; no new route surface. |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceModalStack.tsx` | Removed mounted legacy block-add modal path. | Shrinks active UI surface and avoids dual flows. |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceModalShellProps.ts` | Removed dead block-add prop chain. | Prop cleanup only. |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | Removed add-block compat state from the main orchestrator. | Less state, no new side effects. |
| `app/(backoffice)/backoffice/content/_components/useContentWorkspaceUiState.ts` | Removed dead `addBlockModalOpen` state. | Hook cleanup only. |
| `app/(backoffice)/backoffice/content/_components/_stubs.ts` | Removed compat export for `BlockAddModal`. | Prevents accidental use of the old path. |
| `app/api/backoffice/content/pages/[id]/route.ts` | Preserved existing envelope metadata on blocks-only PATCH. | Localized server fix with regression test coverage. |
| `app/api/backoffice/content/pages/[id]/variant/publish/route.ts` | Flattened publish payload. | Response cleanup covered by targeted tests. |
| `app/api/content/global/settings/route.ts` | Enforced superadmin auth on POST. | Hardens access; no relaxed behavior introduced. |
| `lib/cms/readGlobal.ts` | Added `x-rid` header to public settings reads. | Header addition only. |
| `lib/settings/getSettings.ts` | Made legacy helper fail-closed instead of returning `null`. | Safer compatibility behavior for callers. |
| `lib/esg/latestMonthlyRollupList.ts` | Added explicit `query_failed` degraded path. | Honest fallback behavior with tests. |
| `app/api/auth/login-debug/route.ts` | Fixed local debug login cookie staging crash. | Dev-only safety fix; no production auth broadening. |

## Test Files Updated

- `tests/cms/backofficeWorkspaceContextModel.test.ts`
- `tests/backoffice/settingsRoutes.smoke.test.ts`
- `tests/esg/latestMonthlyRollupList.test.ts`
- `tests/api/variantPublishRoute.test.ts`
- `tests/cms/content-persistence-save-reload.test.ts`
- `tests/api/globalSettingsRoute.test.ts`
- `tests/lib/getSettings.test.ts`
- `tests/cms/contentWorkspaceStability.smoke.test.ts`
