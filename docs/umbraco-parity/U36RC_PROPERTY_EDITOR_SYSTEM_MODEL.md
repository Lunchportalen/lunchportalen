- Title: U36-RC property editor system model
- Scope: make schema, configured instance, editor UI, and preset/defaults explicit without creating a new property engine.
- Repro: compare `blockFieldSchemas.ts`, `SchemaDrivenBlockForm.tsx`, `FieldRenderer.tsx`, and settings data-type/schema pages.
- Expected: one readable model that answers what the schema is, where it is configured, how the UI renders it, and where defaults come from.
- Actual: the parts exist, but they are scattered across code and only partially surfaced in Settings.
- Root cause: Settings exposes kinds and create options, but not the full relation graph between schema, configured instance, UI, and defaults.
- Fix: derive one property-editor system read model from the existing code truth and drive settings/detail pages from it.
- Verification: each data type page and schema workspace can show schema -> configured instance -> UI -> preset linkage.

## U36RC Layers

- Schema:
  field kind definitions and validation semantics.
- Configured instance:
  block-level field registrations, required flags, options, and per-block defaults.
- Editor UI:
  `SchemaDrivenBlockForm.tsx` + `components/backoffice/FieldRenderer.tsx`.
- Preset / defaults:
  block layout defaults and create-option guidance already used by the editor.

## Non-Negotiables

- No new property engine.
- No fake persisted data-type CRUD.
- One shared read model for settings, management-read JSON, and related workspace links.
