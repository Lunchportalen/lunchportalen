# U37 Management Object Model

## First-Class Objects In Scope
- `document_type`
  - Collection: `/backoffice/settings/document-types`
  - Detail workspace: `/backoffice/settings/document-types/[alias]`
  - Truth: code-governed, runtime-enforced

- `data_type`
  - Collection: `/backoffice/settings/data-types`
  - Detail workspace: `/backoffice/settings/data-types/[kind]`
  - Truth: code-governed, UI-mapped

- `property_editor_system`
  - Workspace: `/backoffice/settings/schema`
  - Truth: code-governed read model for schema -> configured instance -> UI -> preset

- `create_policy`
  - Workspace: `/backoffice/settings/create-policy`
  - Truth: code-governed, runtime-enforced in tree/body flows

- `ai_governance`
  - Workspace: `/backoffice/settings/ai-governance`
  - Truth: mixed management/runtime read

- `system_settings`
  - Workspace: `/backoffice/settings/system`
  - Truth: runtime-managed, persisted, high-risk

## UX Rule
- Every object must expose a clear collection or workspace entry point.
- Every object must say whether it is code-governed, runtime-read, or runtime-managed.
- No page may pretend persisted CRUD exists when only code/deploy governs the object.
