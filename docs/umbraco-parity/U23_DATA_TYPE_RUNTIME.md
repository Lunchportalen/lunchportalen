# U23 — Data type runtime

## Oppførsel

- **Felt-kinds**: `EDITOR_FIELD_KIND_GOVERNANCE` i `backofficeSchemaSettingsModel.ts` — forklaringstabell på `/backoffice/settings/schema`; må holdes i takt med `EditorFieldKind` i `blockFieldSchemas.ts`.
- **Blokktyper**: Synliggjort som create options fra `EDITOR_BLOCK_CREATE_OPTIONS`.

## Vedlikehold

- Ved ny `EditorFieldKind`: utvid governance-array og verifiser i code review.
