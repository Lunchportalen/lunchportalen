# U34 Execution Plan

- Title: U34 Bellissima structural closure
- Scope: section discipline, content workspace ownership, shared workspace context truth, management workspaces, and tree/audit hardening.
- Repro:
  1. Open `/backoffice/content`.
  2. Open `/backoffice/content/[id]`.
  3. Open `/backoffice/settings` plus document type, data type, schema, governance, and management workspaces.
- Expected: one clearer Bellissima-like control-plane line where section -> tree/collection -> workspace ownership is explicit.
- Actual: U33 closed the first runtime layer, but content still has compat/state leftovers and settings still lacks a first-class workspace model.
- Root cause: host/context/action primitives exist, but not all workspace ownership moved onto them.
- Fix: finish the structural closure instead of layering more local props/state on top.
- Verification:
  - `typecheck`
  - `lint`
  - `build:enterprise`
  - `test:run`

## U34 Moves

- Make content host own section snapshots so section routes stop publishing parallel shell truth.
- Push more preview/view shell state into the canonical Bellissima workspace context.
- Remove the `MainView` compatibility layer and let content runtime read Bellissima view truth directly.
- Introduce one shared settings management workspace model and reuse it across collection/detail pages.
- Make settings expose first-class workspaces for document types, data types, schema/presets, create policy, management read, and AI governance.
- Tighten topbar/section composition so section choice stays first-class and module overflow becomes calmer.
- Expand tree/audit degraded truth with clearer operator messaging in UI and tests.
