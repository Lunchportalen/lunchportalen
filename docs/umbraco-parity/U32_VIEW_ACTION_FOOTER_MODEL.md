# U32 View Action Footer Model

- Title: Explicit workspace views, actions, footer apps, and reusable entity actions
- Scope: content workspace views, workspace action model, persistent footer apps, and shared entity action semantics across tree / landing / workspace / settings links.
- Repro:
  1. Inspect current content editor chrome and footer.
  2. Observe that views/actions/footer posture is still split between inner editor controls and partial footer metadata.
- Expected: views, actions, and footer apps are explicit host-level workspace concepts.
- Actual: views exist, but are not fully host-owned; actions are still mostly button props; footer apps are real only for part of the runtime.
- Root cause: shell concepts were derived after the editor implementation rather than driving it.
- Fix: make the workspace model explicit and shared, and attach UI readers to that model.
- Verification:
  - explicit workspace views render from the shared model
  - primary and secondary actions resolve consistently
  - footer apps stay persistent and readable

## Workspace Views Now

- `content`
- `preview`
- `history`
- `global`
- `design`

## Workspace Apps / Panels Now

- `SEO`
  - stays a governed panel within the content workspace for now
- `Diagnose/runtime`
  - stays an explicit diagnose panel fed by tree/audit/runtime posture
- `AI`
  - stays an explicit workspace-side app/panel

## Primary Actions

- `save`
- `publish`
- `preview/open`
- `create` on section landing

## Secondary Actions

- `history`
- `settings`
- `governance`
- `reload/retry/support` where runtime posture requires it

## Footer Apps

- publish state
- save state
- history state
- governance posture
- document type
- preview/runtime linkage

## Reused Entity Actions

- `edit/open workspace`
- `preview`
- `history`
- `settings`
- `copy link`

## Tree-Only Safe Extras

- `create child`
- `rename`
- `move`
- `delete`

These remain tree-scoped because they depend on node permissions and mutation flow, but they should follow the same ordering and naming posture as the shared entity actions.
