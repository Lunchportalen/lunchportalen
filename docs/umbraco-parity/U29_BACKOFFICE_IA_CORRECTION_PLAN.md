# U29 — Backoffice IA correction plan

## Top-level navigasjon

- **Før:** Én horisontal liste med ~20 faner.
- **Etter:** Rad 1 = **5 seksjoner** (`BACKOFFICE_NAV_GROUP_ORDER`). Rad 2 = kun lenker i aktiv seksjon.

## Settings som førsteordens seksjon

- **Layout:** `app/(backoffice)/backoffice/settings/layout.tsx` + `SettingsSectionChrome` med sidenav.
- **Workspaces:** `/settings/document-types`, `/settings/document-types/[alias]`, `/settings/data-types`, `/settings/data-types/[kind]`, `/settings/create-policy`.
- **Canonical:** `create-options` → redirect til `create-policy`.

## Section vs lokal workspace

- Settings: sidenav = lokal workspace-navigasjon; hub = oversikt.
- Content: uendret tree+workspace (kun bredde/preview-justering).

## Preview / inspector

- Preview-kolonne får høyere minimumsbredde i split-modus; inspector ikke full refaktor i U29.

## Skjermer oppdatert (U29)

- `TopBar.tsx`, `SectionShell.tsx`, `ContentWorkspaceMainCanvas.tsx` (grid).
- `CmsHistoryDiscoveryStrip.tsx`, `CmsRuntimeStatusStrip.tsx`, `BackofficeExtensionContextStrip.tsx`.
- Settings: layout, hub, nye routes, schema import cleanup.

## Må vente

- Full Bellissima-paritet for workspace chrome (footer apps, content apps grid).
