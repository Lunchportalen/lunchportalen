# U34 Changed Files

- Title: Rolling U34 file ledger
- Scope: only files touched to close structural gaps in U34.
- Repro: inspect during execution and confirm against final diff.
- Expected: concise ledger of runtime-bearing changes.
- Actual: created empty at U34 start.
- Root cause: runtime edits not landed yet.
- Fix: append touched files with why and minimal-risk reasoning.
- Verification: final list matches real git diff.

## Initial Steering Docs

- `docs/umbraco-parity/U34_EXECUTION_PLAN.md`
- `docs/umbraco-parity/U34_SECTION_WORKSPACE_OWNERSHIP_MODEL.md`
- `docs/umbraco-parity/U34_WORKSPACE_CONTEXT_MODEL.md`
- `docs/umbraco-parity/U34_MANAGEMENT_WORKSPACES_MODEL.md`
- `docs/umbraco-parity/U34_CHANGED_FILES.md`
- `docs/umbraco-parity/U34_EXECUTION_LOG.md`

## Content Host And Context Closure

- `lib/cms/backofficeWorkspaceContextModel.ts` — added preview/device/layout/footer app truth to the canonical Bellissima workspace model.
- `components/backoffice/ContentBellissimaWorkspaceContext.tsx` — made the provider own preview/view shell state and exported the new Bellissima view/presentation hooks.
- `app/(backoffice)/backoffice/content/_components/useContentWorkspaceUi.ts` — switched content UI to the shared Bellissima presentation/view state.
- `app/(backoffice)/backoffice/content/_components/useContentWorkspaceShell.ts` — removed `MainView` compat usage in shell consumers.
- `app/(backoffice)/backoffice/content/_components/useContentWorkspaceNavigation.ts` — removed `MainView` compat usage in navigation consumers.
- `app/(backoffice)/backoffice/content/_components/useContentWorkspaceData.ts` — aligned the navigation setter contract with direct Bellissima view updates.
- `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceHost.tsx` — made the canonical host own section snapshot publishing.
- `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceLayout.tsx` — re-exported section registration for the canonical host line.
- `app/(backoffice)/backoffice/content/_workspace/ContentSectionLanding.tsx` — registers section snapshot/action state with the host instead of publishing directly.
- `app/(backoffice)/backoffice/content/_components/useContentWorkspaceBellissima.ts` — new shared hook for entity snapshot building/publishing.
- `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` — consumes the extracted Bellissima hook instead of owning snapshot publishing inline.
- `app/(backoffice)/backoffice/content/_workspace/MainViewContext.tsx` — deleted to remove the dead `MainView` compatibility layer.

## Settings And Management Workspaces

- `lib/cms/backofficeExtensionRegistry.ts` — added `ai-governance`, reduced topbar overflow, and aligned settings workspace registrations.
- `lib/cms/backofficeSettingsWorkspaceModel.ts` — new shared management workspace model for collection/detail surfaces.
- `components/backoffice/BackofficeManagementWorkspaceFrame.tsx` — new shared frame for management workspaces.
- `app/(backoffice)/backoffice/settings/page.tsx` — surfaced AI governance and stronger management workspace links.
- `app/(backoffice)/backoffice/settings/document-types/page.tsx` — moved into the shared management workspace frame.
- `app/(backoffice)/backoffice/settings/document-types/[alias]/page.tsx` — moved detail posture into the shared management workspace frame.
- `app/(backoffice)/backoffice/settings/data-types/page.tsx` — moved into the shared management workspace frame.
- `app/(backoffice)/backoffice/settings/data-types/[kind]/page.tsx` — moved detail posture into the shared management workspace frame.
- `app/(backoffice)/backoffice/settings/create-policy/page.tsx` — converted to an explicit management workspace.
- `app/(backoffice)/backoffice/settings/schema/page.tsx` — converted to an explicit management workspace.
- `app/(backoffice)/backoffice/settings/management-read/page.tsx` — converted to an explicit management workspace.
- `app/(backoffice)/backoffice/settings/ai-governance/page.tsx` — new first-class AI governance workspace under settings.
- `app/(backoffice)/backoffice/settings/_components/SettingsSectionChrome.tsx` — added clearer section/group/honesty posture chips.
- `components/backoffice/BackofficeWorkspaceFooterApps.tsx` — aligned settings footer quick links with the new management posture.
- `app/(backoffice)/backoffice/_shell/TopBar.tsx` — made the active section primary and reduced module clutter.

## Tree Audit And Tests

- `app/(backoffice)/backoffice/content/_tree/mapTreeApiRoots.ts` — added `technicalDetail` handling and fixed envelope parsing order.
- `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx` — shows operator message plus technical detail for degraded tree mode.
- `app/(backoffice)/backoffice/content/_components/ContentWorkspaceAuditTimeline.tsx` — shows degraded audit reason and technical detail more honestly.
- `tests/cms/bellissimaWorkspaceContext.test.ts` — covers new preview footer apps in the shared workspace model.
- `tests/cms/backofficeExtensionRegistry.test.ts` — verifies settings workspace alignment including AI governance.
- `tests/cms/backofficeSettingsWorkspaceModel.test.ts` — new coverage for the shared management workspace model.
- `tests/cms/mapTreeApiRoots.test.ts` — verifies operator message/schema hint/technical detail separation.
- `tests/api/contentAuditLogRoute.test.ts` — verifies degraded audit detail output.
- `tests/cms/backofficeExtensionRegistryU31.test.ts` — aligned the legacy topbar overflow expectation with the intentional U34 reduction.

## U34 Final Docs

- `docs/umbraco-parity/U34_DECISION.md`
- `docs/umbraco-parity/U34_TRAFFIC_LIGHT_MATRIX.md`
- `docs/umbraco-parity/U34_SIGNOFF.md`
- `docs/umbraco-parity/U34_OPEN_RISKS.md`
- `docs/umbraco-parity/U34_NEXT_STEPS.md`
