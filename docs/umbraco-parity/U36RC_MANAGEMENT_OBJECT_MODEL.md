- Title: U36-RC management object model
- Scope: document types, data types, schema/presets, create policy, management read, AI governance, and system as first-class objects inside Settings.
- Repro: open the settings hub, collections, and detail/workspace routes.
- Expected: explicit collection -> workspace flow with clear actions, honesty, and related-object links.
- Actual: settings is structurally real, but some routes still read like strong docs instead of management objects with relations and object-level traceability.
- Root cause: object metadata exists, but relations and usage flows are still too implicit.
- Fix: read every settings surface from one shared management-object vocabulary and one property-editor/system model.
- Verification: a user can navigate object -> related object -> runtime/read-model without guessing files or hidden rules.

## First-Class Objects In U36RC

- Document types:
  collection, detail workspace, related data-type usage, create-policy links, content routing.
- Data types:
  collection, detail workspace, configured-instance usage, editor-UI mapping, document-type linkage.
- Schema / presets:
  explicit system workspace for schema, configured instances, UI mapping, and defaults.
- Create policy:
  workspace that maps document types to tree policy and block allowlist enforcement.
- Management read:
  workspace that exposes the same object graph as JSON and as readable object rows.
- AI governance:
  workspace tied into the same management-object logic, not a parallel settings style.

## Honesty Rule

- Code-governed may remain code-governed.
- Runtime-read may remain runtime-read.
- Persisted CRUD must not be implied.
- UI must still make each object legible and navigable as a real management object.
