# U38 Execution Plan

- Title: U38 Final Editor Convergence + Management Object Lifecycle + Bellissima Proof
- Scope: Content workspace convergence, settings management objects, property editor clarity, runtime truth corrections, proof and verification.
- Repro: `ContentWorkspace` carried too much orchestration, block insert lived in two UI paths, settings objects were still read-model heavy, and several runtime routes drifted from the canonical contract.
- Expected: One visible workspace truth line, first-class management flows for document/data types, explicit schema -> instance -> UI -> preset mapping, and honest runtime envelopes.
- Actual: Editor truth, management truth, and runtime truth were still split across props, helper wrappers, and inconsistent response payloads.
- Root cause: Transitional state and helper layers survived earlier phases, while settings/runtime corrections landed unevenly across CMS surfaces.
- Fix: Remove the mounted block-add compat path, derive settings views from the registry, surface management links inside the workspace, and correct page/settings/ESG/global route behavior.
- Verification: `npm run typecheck`, `npm run lint`, `npm run build:enterprise`, `npm run test:run`, plus route screenshots under `docs/umbraco-parity/u38-screen-proof/`.

## Structural Gaps Closing Now

- Editor convergence: single block insert line via `BlockPickerOverlay`, less modal drift, stronger workspace-to-settings linkage.
- Management object flow: document types and data types expose explicit flow cards and object relationships instead of passive description tables.
- Property editor clarity: new document-type and kind flow helpers make schema -> configured instance -> UI -> preset visible to both settings and editor governance.
- Runtime truth: page PATCH preserves existing envelope metadata, publish returns a clean payload, ESG degrades honestly, and global settings writes are auth-gated.
- Registry truth: settings tabs now derive directly from the canonical settings collection registry.

## Workstream Order

1. Collapse editor block insertion to one mounted path.
2. Lift management-object flow into document/data type workspaces and content governance rail.
3. Tighten entity actions/footer shortcuts from the Bellissima workspace model.
4. Correct page/global/settings/ESG runtime envelopes.
5. Run full verification gates.
6. Capture route proof when a valid superadmin session is available.

## Stop Rule A Summary

- Structural gaps to close now: dual insert flow, weak management object visibility, runtime envelope drift, registry/tab duplication.
- Compat to shut down now: mounted `BlockAddModal` path, `addBlockModalOpen` state chain, dead add-block state in legacy UI hook, settings tabs not sourced from registry.
- Management objects to make first-class now: document types, data types, schema/system mapping, presets/defaults, create policy links inside the editor.
- Runtime truth errors to close now: blocks-only PATCH envelope loss, nested publish payload, unauthenticated global settings POST, missing `x-rid` on public global GET, null-collapsing settings helper, opaque ESG failures.
- UI proof required: `/backoffice/content`, `/backoffice/content/[id]`, `/backoffice/settings`, `/backoffice/settings/document-types/[alias]`, `/backoffice/settings/data-types/[kind]`, `/backoffice/settings/create-policy`, degraded tree state, degraded audit state.
