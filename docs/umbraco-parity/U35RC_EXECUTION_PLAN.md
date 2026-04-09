# U35RC Execution Plan

- Title: U35-RC Bellissima final structural closure
- Scope: workspace truth, compat shutdown, management objects, entity actions/collections, and tree/audit clarity.
- Repro:
  1. Open `/backoffice/content`.
  2. Open `/backoffice/content/[id]`.
  3. Open `/backoffice/settings`, `/backoffice/settings/document-types`, `/backoffice/settings/data-types`, `/backoffice/settings/create-policy`, and `/backoffice/settings/system`.
- Expected: one Bellissima-like control-plane line where section -> tree/collection -> workspace ownership is explicit, management objects are first-class, and editor/runtime chrome no longer competes with itself.
- Actual: U34 left the system structurally cleaner, but host/entity publish, inspector/chrome vocabulary, and settings object modeling are still not fully converged.
- Root cause: parity primitives exist, but a few compat layers and duplicated label/state/action patterns still dilute canonical ownership.
- Fix: finish the closure instead of layering more local props, extra labels, or transitional wrappers.
- Verification:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build:enterprise`
  - `npm run test:run`

## U35RC Moves

- Unify content publish/workspace truth so section host and entity workspace do not compete for one provider snapshot.
- Remove or thin remaining compat layers around workspace layout, legacy inspector tabs, duplicate view labels, and transitional barrels.
- Make workspace views/actions/footer apps stronger model-owned primitives instead of half model / half editor chrome.
- Turn settings hub, governance, system, document types, data types, schema/presets, and create policy into one clearer management object flow.
- Clarify schema vs configured instance vs property editor UI using one shared metadata line instead of duplicated governance tables.
- Consolidate entity actions and collection affordances across tree, settings collections, and workspace overflow menus.
- Tighten tree/audit operator truth where degraded state can still read as fragmented or contradictory.
