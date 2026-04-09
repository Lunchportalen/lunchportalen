# U32 - Workspace context target

## Canonical context
- Keep `ContentBellissimaWorkspaceContext` as the single provider.
- Expand it from `snapshot` only to a real workspace model for the active content entity.

## Must live in context
- Section id/label, collection/workspace id, entity id.
- Document type alias, governed posture, publish state, save state, dirty.
- Active workspace view and available workspace views.
- Preview href/state and history status.
- Runtime linkage and posture hints where relevant.
- Primary actions, secondary actions, footer apps, entity actions.

## May stay local UI state
- Block hover/selection.
- Modal open state.
- DnD/transient editor focus state.
- Preview device and temporary inspector accordions.

## Actions on context
- Context carries action descriptors and current availability.
- Existing callbacks remain in editor/runtime code; U32 must not invent a new mutation engine.

## Context consumers
- Footer apps.
- Editor chrome / workspace view tabs.
- History / governance workspace surface.
- Inspector/runtime panels that need the same entity/view truth.

## Data sources
- Route host provides active section workspace and entity id.
- Existing content page APIs provide document/publish/history data.
- Existing editor state provides save/dirty/preview signals.

## Anti-goal
- No second editor state machine.
- No duplicate route truth.
- No fake persisted settings/history platform.
