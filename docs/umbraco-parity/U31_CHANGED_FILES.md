# U31 — Changed files

Updated after runtime consolidation and gate verification. Code changes are **not** docs-only.

| Area | Files | Why |
|------|--------|-----|
| Tree truth | `lib/cms/contentTreeRoots.ts`, `app/api/backoffice/content/tree/route.ts`, `app/api/backoffice/content/pages/route.ts`, `app/api/backoffice/content/tree/move/route.ts`, `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx` | Én kanonisk root-/folder-/fixed-page-modell på tvers av API og UI |
| Registry / sections | `lib/cms/backofficeExtensionRegistry.ts`, `lib/cms/backofficeNavItems.ts`, `app/(backoffice)/backoffice/_shell/TopBar.tsx`, `components/backoffice/BackofficeExtensionContextStrip.tsx` | Konsolidert section-metadata, planes og workspace-view-definisjoner |
| Content landing / settings | `app/(backoffice)/backoffice/content/_workspace/ContentSectionLanding.tsx`, `app/(backoffice)/backoffice/settings/_components/SettingsSectionChrome.tsx`, `app/(backoffice)/backoffice/settings/page.tsx` | Tydeligere content-first entry og mer operativ management-hub |
| Workspace context | `lib/cms/backofficeWorkspaceContextModel.ts`, `components/backoffice/ContentBellissimaWorkspaceContext.tsx`, `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | Bellissima-snapshot med section/workspace/historikk/action-signaler |
| Footer apps | `components/backoffice/BackofficeWorkspaceFooterApps.tsx` | Menneskelige labels, view-aware actions og tydeligere historikk-/governance-status |
| Editor chrome | `app/(backoffice)/backoffice/content/_components/RightPanel.tsx`, `app/(backoffice)/backoffice/content/_components/ContentWorkspaceTriPaneSection.tsx`, `app/(backoffice)/backoffice/content/_components/ContentWorkspaceMainCanvas.tsx`, `app/(backoffice)/backoffice/content/_components/ContentWorkspacePropertiesRail.tsx` | Roligere tri-pane, større preview og faktisk app-separasjon mellom innhold/design/governance |
| Gate fix | `app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx` | Ryddet én eksisterende lint-blokkerer for å få grønn gate |
| Docs | `docs/umbraco-parity/U31_*.md` | Sluttleveranse oppdatert til faktisk runtime-status og verifikasjon |
