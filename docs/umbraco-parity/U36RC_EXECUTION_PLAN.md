- Title: U36-RC final Bellissima closure + no-excuses build
- Scope: workspace truth, management objects, property editor system, entity actions/collections, tree/audit operator UX, and compat shutdown.
- Repro:
  1. Open `/backoffice/content` and `/backoffice/content/[id]`.
  2. Open `/backoffice/settings` plus document types, data types, schema, create policy, management read, AI governance, and system.
  3. Trigger tree/audit degraded branches through existing tests and route mocks.
- Expected: one explicit Bellissima-like control plane where workspace context owns shell truth, Settings behaves like a management section, property editor layers are readable in UI, and degraded operator states are honest and useful.
- Actual: U35 closed major structural gaps, but footer truth is still partly ad hoc, settings/property-editor flows are still too read-model heavy, discovery/collection actions are still uneven, and compat barrels/shims still survive.
- Root cause: canonical primitives exist, but a few remaining wrapper layers, weak management-read surfaces, and under-modeled property-editor relations still dilute ownership.
- Fix: finish the structural closure instead of adding more labels or local helper truth.
- Verification:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build:enterprise`
  - `npm run test:run`

## U36RC Moves

- Make `ContentBellissimaWorkspaceContext` + `backofficeWorkspaceContextModel.ts` the only shared owner of active view, actions, footer apps, preview posture, governance posture, and runtime linkage chips.
- Turn footer apps into real persistent primitives by moving footer-visible truth into the canonical workspace model and removing ad hoc footer-only status lines.
- Build one explicit property-editor system model that shows schema, configured instances, editor UI mapping, defaults/presets, and document-type usage without inventing a new engine.
- Upgrade Settings from overview prose to explicit collection -> workspace flows for document types, data types, schema/presets, create policy, management read, and AI governance.
- Consolidate entity-action language across tree, collections, workspace header, and discovery surfaces.
- Strengthen degraded tree/audit payloads and operator messaging so schema drift is visible, traceable, and safe.
- Remove or neutralize surviving compat layers that still point developers at non-canonical files.
