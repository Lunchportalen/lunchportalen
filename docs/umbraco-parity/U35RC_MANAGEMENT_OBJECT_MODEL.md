# U35RC Management Object Model

- Title: U35-RC management object model
- Scope: document types, data types, presets/schema, create policy, management read, AI governance, and system inside Settings.
- Repro: inspect settings hub plus collection/detail/workspace routes.
- Expected: first-class management objects in UI, even where truth remains code-governed.
- Actual: collection/detail patterns exist, but hub/system/governance/property-editor story still reads too much like docs and split registries.
- Root cause: one shared frame/model exists, but not all management surfaces and object layers are fully on it.
- Fix: make management objects explicit, navigable, action-bearing, and structurally consistent.
- Verification: settings reads like a control surface, not product docs.

## First-Class Objects

- Document types:
  collection view
  detail workspace
  actions to open content, create policy, related schema/object flows

- Data types:
  collection view
  detail workspace
  explicit split between kind/schema contract, configured instance usage, and editor UI linkage

- Presets / schema:
  workspace or collection read focused on schema contract, configured instance, and usage
  not a second generic dump of the same tables

- Create policy:
  first-class workspace for allowed child types, allowed block types, and entity create options

- AI governance:
  first-class management workspace tied to AI Center and runtime/system surfaces

- System:
  runtime-read / mutable management workspace that still sits inside the same settings section logic

## Collection Views Required

- `/backoffice/settings/document-types`
- `/backoffice/settings/data-types`
- `/backoffice/settings/schema`
- `/backoffice/settings/create-policy`
- `/backoffice/settings/management-read`

## Detail / Workspace Views Required

- `/backoffice/settings/document-types/[alias]`
- `/backoffice/settings/data-types/[kind]`
- system and governance workspaces on the same shared management frame/model

## Actions Required

- open detail workspace
- open related management object
- open content/runtime surface where safe
- open JSON/read-model endpoint where it adds traceability

## Honesty Rule

- Code-governed and read-only may remain code-governed and read-only.
- UI must still treat them as first-class management objects.
- Persisted CRUD must never be implied if it does not exist.

## Navigation Rule

- Settings is a first-class management section.
- Document types, data types, schema/presets, create policy, management read, AI governance, and system must all be visible as first-order objects/workspaces inside that section.
