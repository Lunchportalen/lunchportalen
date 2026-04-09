- Title: U36-RC changed files
- Scope: rolling ledger for runtime and docs touched in U36-RC.
- Repro: review each file before commit/signoff.
- Expected: explicit file + why + minimal-risk reason.
- Actual: phase just started.
- Root cause: none.
- Fix: append every meaningful runtime/doc/test change as it lands.
- Verification: final ledger matches git diff.

## Initial Entries

- `docs/umbraco-parity/U36RC_EXECUTION_PLAN.md`
  why: lock scope and verification gates before code.
  minimal-risk reason: docs only; no runtime behavior.
- `docs/umbraco-parity/U36RC_COMPAT_REMOVAL_PLAN.md`
  why: identify which legacy layers can actually be removed in this phase.
  minimal-risk reason: docs only; no runtime behavior.
- `docs/umbraco-parity/U36RC_WORKSPACE_TRUTH_MODEL.md`
  why: pin the canonical workspace owner before editing shell code.
  minimal-risk reason: docs only; no runtime behavior.
- `docs/umbraco-parity/U36RC_MANAGEMENT_OBJECT_MODEL.md`
  why: pin the object vocabulary for settings flows.
  minimal-risk reason: docs only; no runtime behavior.
- `docs/umbraco-parity/U36RC_PROPERTY_EDITOR_SYSTEM_MODEL.md`
  why: pin the schema/configured-instance/UI/preset split.
  minimal-risk reason: docs only; no runtime behavior.
- `docs/umbraco-parity/U36RC_EXECUTION_LOG.md`
  why: keep chronological evidence while runtime changes land.
  minimal-risk reason: docs only; no runtime behavior.

## Runtime + Tests

- `lib/cms/backofficeExtensionRegistry.ts`
  why: add explicit settings object-class / flow-kind metadata so settings chrome and workspaces stop guessing.
  minimal-risk reason: shared registry enrichment; no new runtime engine.
- `lib/cms/backofficeSettingsWorkspaceModel.ts`
  why: provide canonical labels for settings object classes and flows.
  minimal-risk reason: presentation helper only.
- `components/backoffice/BackofficeManagementWorkspaceFrame.tsx`
  why: show management-object metadata in the canonical frame instead of generic chips.
  minimal-risk reason: shared frame reads registry metadata only.
- `app/(backoffice)/backoffice/settings/_components/SettingsSectionChrome.tsx`
  why: make settings chrome show the same object/flow truth as the frame.
  minimal-risk reason: chrome consumes canonical registry metadata.
- `lib/cms/backofficeSchemaSettingsModel.ts`
  why: derive one explicit property-editor system model for schema, configured instances, UI mappings, presets, coverage gaps, and usage summaries.
  minimal-risk reason: read-model only; reuses existing code truth.
- `app/api/backoffice/content/governance-registry/route.ts`
  why: expose `propertyEditorSystem` through the management-read JSON payload.
  minimal-risk reason: additive read-only API field.
- `app/(backoffice)/backoffice/settings/page.tsx`
  why: switch settings hub signals from prose-level counts to property-editor system counts.
  minimal-risk reason: management-read surface only.
- `app/(backoffice)/backoffice/settings/document-types/page.tsx`
  why: make document types a first-class collection with schema/management actions and usage metrics.
  minimal-risk reason: settings-only collection UI.
- `app/(backoffice)/backoffice/settings/document-types/[alias]/page.tsx`
  why: turn document-type detail into a real management workspace with configured-instance, preset, coverage, and related-object linkage.
  minimal-risk reason: settings-only detail UI.
- `app/(backoffice)/backoffice/settings/data-types/page.tsx`
  why: upgrade data types from static kind list to management objects with instance/preset/document-type reach.
  minimal-risk reason: settings-only collection UI.
- `app/(backoffice)/backoffice/settings/data-types/[kind]/page.tsx`
  why: surface configured instances, document types, presets, and UI mappings per data type.
  minimal-risk reason: settings-only detail UI.
- `app/(backoffice)/backoffice/settings/schema/page.tsx`
  why: make schema workspace show the full schema -> configured instance -> UI -> preset system model and coverage gaps.
  minimal-risk reason: read-only settings surface.
- `app/(backoffice)/backoffice/settings/management-read/page.tsx`
  why: turn management-read into an explicit collection/flow registry and governance payload workspace.
  minimal-risk reason: read-only settings surface.
- `app/(backoffice)/backoffice/settings/create-policy/page.tsx`
  why: make create policy read as document-type policy truth, not just explanatory prose.
  minimal-risk reason: read-only settings surface.
- `lib/cms/backofficeWorkspaceContextModel.ts`
  why: expand canonical footer-app and action truth with grouped shortcuts, document-type linkage, and governance/status signals.
  minimal-risk reason: shared model closure; no new runtime source.
- `components/backoffice/BackofficeWorkspaceFooterApps.tsx`
  why: render footer entirely from canonical footer apps instead of local recomposition.
  minimal-risk reason: consumer-only refactor; model already owns truth.
- `app/api/backoffice/content/tree/route.ts`
  why: add operator-action guidance to degraded tree payloads.
  minimal-risk reason: additive degraded metadata only.
- `app/(backoffice)/backoffice/content/_tree/mapTreeApiRoots.ts`
  why: parse new operator-action metadata from tree payload into the UI envelope.
  minimal-risk reason: additive envelope parsing.
- `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx`
  why: show degraded operator next-step guidance directly in the tree warning banner.
  minimal-risk reason: UI reads additive payload only.
- `app/api/backoffice/content/audit-log/route.ts`
  why: add operator-action guidance to degraded audit payloads.
  minimal-risk reason: additive degraded metadata only.
- `app/(backoffice)/backoffice/content/_components/ContentWorkspaceAuditTimeline.tsx`
  why: show audit degraded next-step guidance in the timeline surface.
  minimal-risk reason: UI reads additive payload only.
- `components/backoffice/BackofficeCommandPalette.tsx`
  why: point discovery directly to the canonical extension registry after compat-barrel removal.
  minimal-risk reason: import-only cleanup.
- `lib/cms/backofficeNavItems.ts`
  why: remove the obsolete compat barrel so command palette and tests read the canonical registry directly.
  minimal-risk reason: pure compat shutdown; no surviving imports.
- `tests/api/treeRouteDegradable.test.ts`
  why: lock new degraded operator-action payload for tree route.
  minimal-risk reason: verification only.
- `tests/api/contentAuditLogRoute.test.ts`
  why: lock new degraded operator-action payload for audit route.
  minimal-risk reason: verification only.
- `tests/cms/backofficeDiscoveryIndex.test.ts`
  why: point discovery tests at canonical registry import path.
  minimal-risk reason: verification only.
- `tests/cms/backofficeCommandPalette.test.ts`
  why: point command-palette tests at canonical registry import path.
  minimal-risk reason: verification only.
- `tests/cms/backofficeSchemaSettingsModel.test.ts`
  why: lock the new property-editor system model and relationship summaries.
  minimal-risk reason: verification only.
- `tests/backoffice/settingsRoutes.smoke.test.ts`
  why: lock settings-route data presence against the new property-editor system model.
  minimal-risk reason: verification only.
- `tests/cms/backofficeWorkspaceContextModel.test.ts`
  why: align workspace footer expectations with the new document-type shortcut truth.
  minimal-risk reason: verification only.
- `tests/cms/contentWorkspaceStability.smoke.test.ts`
  why: remove async timing flake revealed by full-suite verification.
  minimal-risk reason: test-only stabilization.

## Final Docs

- `docs/umbraco-parity/U36RC_DECISION.md`
  why: record the actual U36 decision and what closed versus what remains honest.
  minimal-risk reason: docs only.
- `docs/umbraco-parity/U36RC_TRAFFIC_LIGHT_MATRIX.md`
  why: map hard-exit requirements to green/yellow/red with evidence.
  minimal-risk reason: docs only.
- `docs/umbraco-parity/U36RC_SIGNOFF.md`
  why: capture final verification gates and non-regression signoff.
  minimal-risk reason: docs only.
- `docs/umbraco-parity/U36RC_OPEN_RISKS.md`
  why: make residual risk explicit instead of implied.
  minimal-risk reason: docs only.
- `docs/umbraco-parity/U36RC_NEXT_STEPS.md`
  why: separate true post-U36 follow-up from this phase’s closure.
  minimal-risk reason: docs only.
