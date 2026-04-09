# U35RC Workspace Truth Model

- Title: U35-RC workspace truth model
- Scope: the single canonical Bellissima workspace context and the components that must obey it.
- Repro: inspect content section host, editor workspace, header, footer, and inspector.
- Expected: one context/model line owns workspace truth.
- Actual: Bellissima context exists, but some view/inspector/action/status truth still leaks through local props and helper vocabularies.
- Root cause: canonical model and local editor chrome still overlap.
- Fix: make the Bellissima provider + model the only workspace truth.
- Verification: views/actions/footer apps/inspector/presentation state are model-owned, not duplicated elsewhere.

## Canonical Truth

- Canonical React owner:
  `components/backoffice/ContentBellissimaWorkspaceContext.tsx`

- Canonical snapshot/model builder:
  `lib/cms/backofficeWorkspaceContextModel.ts`

- Canonical section host:
  `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceHost.tsx`

## This Context Must Own

- active workspace snapshot for the current scope
- active workspace view
- primary actions
- secondary actions
- entity actions
- footer apps
- active side app
- active inspector section
- preview device
- preview layout
- preview column visibility
- workspace label / section label / runtime linkage chips derived from the canonical model

## Components That Must Read From The Canonical Model

- `BellissimaWorkspaceHeader`
- `BackofficeWorkspaceFooterApps`
- `ContentWorkspacePropertiesRail`
- `RightPanel`
- `ContentWorkspacePageEditorShell`
- content view tabs / action menus / inspector selectors

## Things That Must Stop Being Local Truth

- `legacyPageTab` as the live inspector selector
- duplicate workspace view labels outside the registry-driven model
- separate section-vs-entity publishers overwriting the same provider snapshot
- duplicated action/status truth split between Bellissima header/footer and editor chrome
- settings/workspace navigation labels that do not come from the canonical registry/model

## Ownership Rule

- Section routes register section snapshot/action state with the host.
- Entity routes register entity snapshot/action state with the same provider line.
- The provider resolves the active workspace scope without “last publisher wins”.
- Views/actions/footer apps are rendered from the derived model, not rebuilt ad hoc in each consumer.
