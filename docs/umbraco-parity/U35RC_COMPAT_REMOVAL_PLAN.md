# U35RC Compat Removal Plan

- Title: U35-RC compat shutdown plan
- Scope: remaining transitional layers competing with canonical host, view, action, footer, and settings truth.
- Repro: inspect current Bellissima runtime and settings shell after U34.
- Expected: only one clear owner per structural concern.
- Actual: a few compat layers still compete with canonical truth.
- Root cause: U34 removed the largest parallels, but some wrappers, legacy vocabularies, and duplicate label/state helpers remain.
- Fix: remove, thin, or box them in explicitly.
- Verification: no surviving layer should compete with the canonical owner after U35RC.

## Competing Layers To Shut Down

- Content host truth:
  `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceLayout.tsx`
  Action: remove as compat wrapper and import `ContentWorkspaceHost` directly.
  Safety: canonical host already lives in `ContentWorkspaceHost.tsx`.

- Workspace publish truth:
  `components/backoffice/ContentBellissimaWorkspaceContext.tsx`
  `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceHost.tsx`
  `app/(backoffice)/backoffice/content/_components/useContentWorkspaceBellissima.ts`
  Action: stop “last publisher wins” behavior by separating section/entity registration from the derived active snapshot.
  Safety: same provider remains canonical; no new host or editor motor is introduced.

- Workspace view truth:
  `lib/cms/backofficeWorkspaceContextModel.ts` (`contentWorkspaceViewLabel`)
  `lib/cms/backofficeExtensionRegistry.ts` (`BACKOFFICE_CONTENT_*_WORKSPACE_VIEWS`)
  Action: delegate labels to the registry-derived model and remove duplicate label truth.
  Safety: same views remain; only duplicated naming is removed.

- Inspector truth:
  `app/(backoffice)/backoffice/content/_components/ContentWorkspacePropertiesRail.tsx`
  `lib/cms/backofficeWorkspaceContextModel.ts` (`ContentBellissimaLegacyInspectorTabId` + legacy mapping helpers)
  Action: remove legacy tab vocabulary from the live workspace path and drive inspector sections directly from Bellissima IDs.
  Safety: inspector panels stay the same; only transitional naming/state is removed.

- Action/footer truth:
  `app/(backoffice)/backoffice/content/_components/ContentTopbar.tsx`
  `components/backoffice/BellissimaWorkspaceHeader.tsx`
  `components/backoffice/BackofficeWorkspaceFooterApps.tsx`
  Action: keep primary/secondary/entity actions and status/footer apps model-owned; reduce editor chrome to support/diagnostics only.
  Safety: no action behavior changes outside the existing safe routes/handlers.

- Settings/workspace truth:
  `app/(backoffice)/backoffice/settings/page.tsx`
  `app/(backoffice)/backoffice/settings/governance-insights/page.tsx`
  `app/(backoffice)/backoffice/settings/system/page.tsx`
  `app/(backoffice)/backoffice/settings/_components/SettingsSectionChrome.tsx`
  `lib/cms/backofficeExtensionRegistry.ts` (`BACKOFFICE_SETTINGS_NAV_GROUPS`)
  Action: move active settings surfaces onto the shared management workspace frame/model and reduce duplicate nav-group structures to derived wrappers or remove them.
  Safety: settings stays on the same routes and truths; only shell/model ownership converges.

- Transitional barrel:
  `lib/cms/backofficeNavItems.ts`
  Action: reduce to explicit thin wrapper or stop importing it where canonical registry can be imported directly.
  Safety: no runtime behavior change; only ownership clarity.

## Canonical Files After U35RC

- Content host: `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceHost.tsx`
- Workspace context + derived model: `components/backoffice/ContentBellissimaWorkspaceContext.tsx`
- Workspace model builders: `lib/cms/backofficeWorkspaceContextModel.ts`
- Settings object model: `lib/cms/backofficeSettingsWorkspaceModel.ts`
- Settings/navigation registry: `lib/cms/backofficeExtensionRegistry.ts`
- Management workspace frame: `components/backoffice/BackofficeManagementWorkspaceFrame.tsx`
