# U30R — Changed files

| Fil | Hvorfor |
|-----|---------|
| `lib/cms/contentTreePageKey.ts` | Slug→page_key inferens + `isMissingColumnError` |
| `lib/cms/auditLogTableError.ts` | Felles klassifisering av manglende audit-tabell (inkl. schema cache) |
| `app/api/backoffice/content/tree/route.ts` | Fallback-select uten `page_key`; `schemaHints`; TypeScript-trygg |
| `app/api/backoffice/content/audit-log/route.ts` | Bruker `auditLogTableError` |
| `app/.../content/_tree/ContentTree.tsx` | Banner ved `schemaHints.pageKeyColumnMissing` |
| `app/.../SectionShell.tsx` | Bredere tree |
| `app/.../ContentWorkspaceMainCanvas.tsx` | Større preview |
| `app/.../RightPanel.tsx` | «Workspace»-seksjon |
| `app/.../settings/page.tsx` | Hub UI-løft |
| `app/.../settings/_components/SettingsSectionChrome.tsx` | Bredere sidenav |
| `lib/cms/backofficeExtensionRegistry.ts` | `BACKOFFICE_SETTINGS_EXTENSION_ID` |
| `supabase/migrations/20260330120000_u30r_content_pages_page_key_if_missing.sql` | Sikrer kolonne |
| `tests/lib/contentTreePageKey.test.ts` | Enhet |
| `tests/lib/auditLogTableError.test.ts` | Enhet |
| `tests/api/treeRoutePageKeyFallback.test.ts` | Integrasjon tree |
| `tests/backoffice/settingsRoutes.smoke.test.ts` | Registry-id |
