# U33 Changed Files

- Title: Rolling U33 file ledger
- Scope: only files touched to close structural gaps in U33.
- Repro: inspect this ledger during execution.
- Expected: short running list, updated as code lands.
- Actual: created empty at U33 start.
- Root cause: execution has not yet completed.
- Fix: append touched files and why they changed.
- Verification: final file list matches real git diff.

## Initial Steering Docs

- `docs/umbraco-parity/U33_EXECUTION_PLAN.md`
- `docs/umbraco-parity/U33_WORKSPACE_HOST_MODEL.md`
- `docs/umbraco-parity/U33_WORKSPACE_CONTEXT_MODEL.md`
- `docs/umbraco-parity/U33_VIEW_ACTION_FOOTER_MODEL.md`
- `docs/umbraco-parity/U33_CHANGED_FILES.md`
- `docs/umbraco-parity/U33_EXECUTION_LOG.md`

## Runtime Files Changed

- `lib/cms/backofficeContentRoute.ts` — canonical route parsing for content landing, detail, growth, and recycle bin.
- `lib/cms/backofficeWorkspaceContextModel.ts` — shared model expanded with side apps, inspector sections, public/runtime links, and calmer footer posture.
- `components/backoffice/ContentBellissimaWorkspaceContext.tsx` — canonical provider now owns workspace shell state, not just snapshot publishing.
- `app/(backoffice)/backoffice/content/_components/useContentWorkspaceUi.ts` — legacy inspector tab state now reads/writes through shared Bellissima context.
- `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceHost.tsx` — host now resolves routes through one parser and keeps tree/workspace coupling aligned.
- `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx` — tree consumes canonical route state and locks structural mutations in degraded reserve mode.
- `app/(backoffice)/backoffice/content/_tree/mapTreeApiRoots.ts` — tree envelope now carries explicit mutation-lock posture.
- `lib/cms/contentTreeRuntime.ts` — shared fail-closed helper for degraded tree mutation posture.
- `app/api/backoffice/content/tree/route.ts` — tree API now returns explicit `mutationsLocked`.
- `app/api/backoffice/content/audit-log/route.ts` — invalid UUID filters now fail with honest `422` instead of silent filtering.
- `components/backoffice/BellissimaWorkspaceHeader.tsx` — primary/secondary actions now live in header; overflow entity actions stay contextual.
- `components/backoffice/BackofficeWorkspaceFooterApps.tsx` — footer reduced to persistent status and management links instead of a second action bar.
- `components/backoffice/BellissimaEntityActionMenu.tsx` — reusable action menu now supports local labeling/styling for collection and landing reuse.
- `components/backoffice/BackofficeWorkspaceViewTabs.tsx` — supports calmer subtle surface for shell-local tabs.
- `app/(backoffice)/backoffice/content/_components/RightPanel.tsx` — right rail now reads side-app state from canonical context.
- `app/(backoffice)/backoffice/content/_components/ContentWorkspacePropertiesRail.tsx` — inspector tabs now mirror shared workspace inspector sections.
- `app/(backoffice)/backoffice/content/_components/ContentSaveBar.tsx` — save bar now shows persistence posture while actions stay in header.
- `app/(backoffice)/backoffice/content/_workspace/ContentSectionLanding.tsx` — landing now reuses shared entity-action language on recent pages.
- `app/(backoffice)/backoffice/_shell/SectionShell.tsx` — tree column widened for stronger content-first section posture.
- `app/(backoffice)/backoffice/content/_components/ContentWorkspaceWorkspaceShell.tsx` — tri-pane proportions updated for broader tree and preview rails.
- `app/(backoffice)/backoffice/content/_components/ContentWorkspaceMainCanvas.tsx` — split preview made larger and calmer.
- `lib/cms/backofficeExtensionRegistry.ts` — registry copy and topbar overflow tuned toward section-first parity.
- `lib/cms/contentDocumentTypes.ts` — document type registry now exposes management-facing hints for settings workspaces.
- `app/(backoffice)/backoffice/settings/page.tsx` — settings hub posture tightened toward management flow.
- `app/(backoffice)/backoffice/settings/_components/SettingsSectionChrome.tsx` — settings honesty now distinguishes code-governed read from explicit batch actions.
- `app/(backoffice)/backoffice/settings/document-types/page.tsx` — collection table replaced by mobile-safe management cards and actions.
- `app/(backoffice)/backoffice/settings/document-types/[alias]/page.tsx` — detail workspace expanded into signals, policy, and related workspaces.
- `app/(backoffice)/backoffice/settings/governance-insights/page.tsx` — honesty fixed: analysis plus explicit batch handling, not fake read-only.

## Files Removed

- `app/(backoffice)/backoffice/content/_workspace/BellissimaContentWorkspaceShell.tsx`
- `components/backoffice/BellissimaWorkspaceFooter.tsx`
- `components/backoffice/BellissimaWorkspaceTabs.tsx`
- `lib/cms/bellissimaWorkspaceContext.tsx`
- `lib/cms/contentTreeSchemaCompat.ts`
- `lib/cms/auditLogCompat.ts`
- `tests/cms/contentTreeSchemaCompat.test.ts`
- `tests/cms/auditLogCompat.test.ts`

## Test Files Changed

- `tests/cms/bellissimaWorkspaceContext.test.ts`
- `tests/cms/mapTreeApiRoots.test.ts`
- `tests/cms/contentTreeHardening.test.ts`
- `tests/api/contentAuditLogRoute.test.ts`
- `tests/cms/backofficeContentRoute.test.ts`
