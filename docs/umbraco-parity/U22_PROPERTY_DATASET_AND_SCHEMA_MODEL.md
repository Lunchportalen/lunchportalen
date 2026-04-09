# U22 — Property dataset og schema model

## I dag

- **`EditorBlockFieldSchema`** (`blockFieldSchemas.ts`): `key`, `label`, `kind`, `required`, `maxLength`, `options`, …
- **`SchemaDrivenBlockForm`**: mapper felt → `FieldRenderer` (UI).
- **`validateEditorField`**: validering = **data contract**-lag.

## Tre-lags modell (U22 forklaringslag)

| Umbraco-lignende | Lunchportalen |
|------------------|----------------|
| Schema / data contract | `EditorBlockFieldSchema` + validering |
| Configured data type | Per-blokk `defaultValues`, `groups`, `requiredKeys` i layout |
| Property editor UI | `FieldRenderer` + modus (media/link/tekst) |

## U22 UI

- **`PropertyDatasetExplainer`**: tabell i blokk-modal — felt, type, regler — **read-only**.

## Ikke-mål

- Parallell JSON-schema-fil eller ny valideringsmotor.
