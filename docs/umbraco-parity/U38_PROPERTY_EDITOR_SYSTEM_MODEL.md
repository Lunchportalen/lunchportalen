# U38 Property Editor System Model

## Canonical Reading Order

1. Schema: `blockFieldSchemas.ts` defines field shape and kind.
2. Configured instance: `backofficeSchemaSettingsModel` resolves every block-field usage for a document type or kind.
3. Editor UI: `SchemaDrivenBlockForm` / `FieldRenderer` render the supported kinds.
4. Preset/defaults: `getBlockDefaultValuesForType()` feeds the create/start values surfaced in settings.

## U38 Additions

- `getPropertyEditorFlowForDocumentType()`
- `getPropertyEditorFlowForKind()`

These helpers feed both settings detail pages and the editor governance rail so the same model is visible in both management and editing surfaces.

## Reading Rule

- Editors should be able to answer “what drives this field?” from the workspace.
- Managers should be able to answer “where is this kind used?” from settings.
- Both answers now come from the same flow helpers, not two separate explanations.
