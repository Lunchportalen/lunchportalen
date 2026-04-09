# U23 — Settings runtime

## Implementasjon

- **`/backoffice/settings`**: Hub med lenker til schema, create-options og system.
- **`/backoffice/settings/system`**: Eksisterende systeminnstillinger (flyttet fra rot); samme API som før (`GET /api/backoffice/settings`, `PUT /api/superadmin/system`).
- **`/backoffice/settings/schema`**: Read-only tabeller for document types, felt-typer og blokk-create options (fra `backofficeSchemaSettingsModel`).
- **`lib/cms/editorBlockCreateOptions.ts`**: Én kilde for blokk-create liste — brukt av `BlockAddModal` og schema-flate.
- **`lib/cms/contentDocumentTypes.ts`**: Kanonisk document type-register; `documentTypes.ts` i app re-eksporterer.

## Ikke-mål

- Ny settings-database eller CRUD på typer i denne fasen.
