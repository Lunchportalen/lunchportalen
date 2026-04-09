# U22 — Property dataset runtime

## Komponent

- **`PropertyDatasetExplainer`** — tabell over `EditorBlockFieldSchema` (felt, editor-type, kontrakt).
- **Plassering:** `BlockEditModal` — `<details>` over `SchemaDrivenBlockForm`.

## Modell

- **Schema / kontrakt:** `blockFieldSchemas.ts` + `validateEditorField`.
- **UI:** `SchemaDrivenBlockForm` → `FieldRenderer`.

## Ikke-mål

- Ny JSON-schema-fil eller parallell valideringsmotor.
