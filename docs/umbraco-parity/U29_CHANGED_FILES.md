# U29 — Changed files

| Fil | Hvorfor |
|-----|---------|
| `app/(backoffice)/backoffice/_shell/TopBar.tsx` | Seksjonsdrevet navigasjon (2 rader) |
| `app/(backoffice)/backoffice/_shell/SectionShell.tsx` | Bredere tre-kolonne |
| `app/(backoffice)/backoffice/settings/layout.tsx` | Settings workspace-shell |
| `app/(backoffice)/backoffice/settings/_components/SettingsSectionChrome.tsx` | Sidenav for settings |
| `app/(backoffice)/backoffice/settings/page.tsx` | Hub med tydelige kort |
| `app/(backoffice)/backoffice/settings/document-types/**` | Collection + workspace |
| `app/(backoffice)/backoffice/settings/data-types/**` | Collection + workspace |
| `app/(backoffice)/backoffice/settings/create-policy/page.tsx` | Create policy workspace |
| `app/(backoffice)/backoffice/settings/create-options/page.tsx` | Redirect til create-policy |
| `app/(backoffice)/backoffice/settings/schema/page.tsx` | Fjernet duplikat breadcrumb |
| `app/.../ContentWorkspaceMainCanvas.tsx` | Preview-kolonne min bredde |
| `components/cms/.../CmsHistoryDiscoveryStrip.tsx` | Kollapsbar stripe |
| `app/.../CmsRuntimeStatusStrip.tsx` | Kollapsbar stripe |
| `components/backoffice/BackofficeExtensionContextStrip.tsx` | Kompaktere kontekst |
| `tests/backoffice/settingsRoutes.smoke.test.ts` | Røyk test registry |
| `docs/umbraco-parity/U29_*.md` | Dokumentasjon |

## U29R — revisjon (IA + workspace + settings)

| Fil | Hvorfor |
|-----|---------|
| `lib/cms/backofficeExtensionRegistry.ts` | `BACKOFFICE_SETTINGS_BASE_PATH`; `nav.settings` bruker samme sti |
| `app/(backoffice)/backoffice/_shell/TopBar.tsx` | Seksjon som én `<select>` (mindre horisontal støy); større modul-lenker |
| `app/(backoffice)/backoffice/_shell/SectionShell.tsx` | Bredere content-tree (320–440px) |
| `app/.../ContentWorkspaceWorkspaceShell.tsx` | Tri-pane: bredere venstre + høyre kolonne for editor/preview/inspector |
| `app/.../ContentWorkspaceMainCanvas.tsx` | Større preview-andel i split; flatere hovedflate |
| `app/.../ContentTopbar.tsx` | Færre parallelle mikro-badges; sterkere Publiser / sekundær rekkefølge |
| `app/.../RightPanel.tsx` | Større høyre-faner (touch/lesbarhet) |
| `app/.../ContentWorkspacePropertiesRail.tsx` | Seksjonstittel «Innholdsapper»; større faner; fulltekst etiketter |
| `app/.../ContentSaveBar.tsx` | Primære lagre-knapper `min-h-11` |
| `app/.../settings/_components/SettingsSectionChrome.tsx` | `h2` «CMS-innstillinger», bredere sidenav, kanonisk base-path |
| `tests/backoffice/settingsRoutes.smoke.test.ts` | Test: settings-path = registry |
