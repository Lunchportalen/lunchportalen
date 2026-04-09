# U35RC Changed Files

- Title: Rolling U35RC file ledger
- Scope: only files touched to close the final structural/editor convergence gaps.
- Repro: compare against final git diff.
- Expected: concise runtime-bearing ledger.
- Actual: created at U35RC start.
- Root cause: runtime edits not landed yet.
- Fix: append files with why and minimal-risk reasoning.
- Verification: final list matches the real diff.

## Initial Steering Docs

- `docs/umbraco-parity/U35RC_EXECUTION_PLAN.md`
- `docs/umbraco-parity/U35RC_COMPAT_REMOVAL_PLAN.md`
- `docs/umbraco-parity/U35RC_WORKSPACE_TRUTH_MODEL.md`
- `docs/umbraco-parity/U35RC_MANAGEMENT_OBJECT_MODEL.md`
- `docs/umbraco-parity/U35RC_CHANGED_FILES.md`
- `docs/umbraco-parity/U35RC_EXECUTION_LOG.md`

## Runtime And Model Closure

- `components/backoffice/ContentBellissimaWorkspaceContext.tsx` — split section vs entity publication so one provider no longer runs last-write-wins across two workspace scopes.
- `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceHost.tsx` — moved section host publishing onto the explicit section publication channel.
- `app/(backoffice)/backoffice/content/_components/useContentWorkspaceBellissima.ts` — moved entity editor publishing onto the explicit entity publication channel.
- `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceLayout.tsx` — removed the U32 compatibility wrapper so host ownership stays with the canonical content host.
- `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` — rewired shell props to the canonical inspector-section model and the canonical host import.
- `app/(backoffice)/backoffice/content/_components/useContentWorkspaceUi.ts` — removed live `legacyPageTab` truth in favor of Bellissima inspector-section state.
- `app/(backoffice)/backoffice/content/_components/contentWorkspaceChromeProps.ts` — aligned chrome build input with inspector-section truth.
- `app/(backoffice)/backoffice/content/_components/contentWorkspaceChromeShellInput.ts` — aligned shell property wiring with inspector-section truth.
- `app/(backoffice)/backoffice/content/_components/ContentWorkspacePropertiesRail.tsx` — removed legacy inspector-tab vocabulary from the live inspector rail.
- `lib/cms/backofficeWorkspaceContextModel.ts` — removed inspector compat mappings, resolved view labels from the canonical registry, and centralized history-status tone helpers.
- `components/backoffice/BellissimaWorkspaceHeader.tsx` — switched history chips onto the shared history-status tone model.
- `app/(backoffice)/backoffice/content/_components/ContentWorkspaceHistoryView.tsx` — switched history cards onto the shared history-status tone model.
- `app/(backoffice)/backoffice/content/_components/ContentWorkspaceAuditTimeline.tsx` — removed the extra audit-status truth line and kept audit responses as detail under the canonical history status.

## Settings Management Objects

- `app/(backoffice)/backoffice/settings/page.tsx` — rebuilt settings overview as a first-class management workspace instead of a descriptive hub.
- `lib/cms/backofficeSettingsWorkspaceModel.ts` — standardized Norwegian honesty/kind labels for the management object layer.
- `app/(backoffice)/backoffice/settings/_components/SettingsSectionChrome.tsx` — moved settings chrome labels onto the shared management label helpers.
- `lib/cms/backofficeExtensionRegistry.ts` — removed the duplicate settings navigation group registry.
- `lib/cms/backofficeNavItems.ts` — removed the legacy settings nav-group export path.
- `app/(backoffice)/backoffice/settings/governance-insights/page.tsx` — moved governance usage onto the shared management workspace frame/model.
- `app/(backoffice)/backoffice/settings/system/page.tsx` — moved system/drift settings onto the shared management workspace frame/model.
- `app/(backoffice)/backoffice/settings/document-types/page.tsx` — aligned collection-card primary/open actions with the canonical workspace action label.
- `app/(backoffice)/backoffice/settings/data-types/page.tsx` — aligned collection-card primary/open actions with the canonical workspace action label.

## Verification And Closeout Docs

- `docs/umbraco-parity/U35RC_DECISION.md` — final U35RC decision and verification posture.
- `docs/umbraco-parity/U35RC_TRAFFIC_LIGHT_MATRIX.md` — final GREEN/YELLOW matrix for closure targets and residual caveats.
- `docs/umbraco-parity/U35RC_SIGNOFF.md` — signoff statement for the phase.
- `docs/umbraco-parity/U35RC_OPEN_RISKS.md` — explicit residual risks after closure.
- `docs/umbraco-parity/U35RC_NEXT_STEPS.md` — post-U35RC follow-up options kept out of the closure phase.
