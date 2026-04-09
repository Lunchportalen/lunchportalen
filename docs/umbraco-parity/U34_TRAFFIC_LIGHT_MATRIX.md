# U34 Traffic Light Matrix

- Title: U34 traffic light matrix
- Scope: structural closure targets delivered in U34.
- Repro: compare the final runtime against the U34 steering docs and Bellissima parity targets.
- Expected: close the remaining yellow/red structural gaps from U33 without adding new motors.
- Actual: the remaining host/context/settings/tree/audit gaps were closed on the current stack.
- Root cause: parity primitives existed, but ownership boundaries were not yet fully enforced.
- Fix: U34 completed ownership/context/management closure on top of the U33 runtime line.
- Verification:
  - Focused U34 vitest pass: PASS
  - Final RC gate rerun: PASS (`typecheck`, `lint`, `build:enterprise`, `test:run`)

| Area | Status | Notes |
| --- | --- | --- |
| Section snapshot ownership | GREEN | `ContentWorkspaceHost` now owns section publishing; landing registers state instead of publishing parallel truth. |
| Shared workspace context truth | GREEN | Preview device/layout/column and active entity view now live in the Bellissima provider line. |
| `MainView` compatibility removal | GREEN | Content runtime reads Bellissima entity view truth directly. |
| Entity workspace snapshot line | GREEN | `useContentWorkspaceBellissima` isolates snapshot build/publish instead of keeping it buried in the page monolith. |
| Settings management workspace model | GREEN | Document types, data types, create policy, schema, management read, and AI governance share one frame/model posture. |
| AI governance as first-class settings workspace | GREEN | Settings now owns an explicit AI governance workspace without inventing a new orchestrator. |
| Section-first topbar posture | GREEN | Active section is primary and overflow is calmer at the registry level. |
| Tree degraded truth | GREEN | Operator message and technical detail are visible together instead of collapsing into vague fallback copy. |
| Audit degraded truth | GREEN | Audit timeline now surfaces degraded reason/detail more honestly. |
| Management honesty posture | GREEN | Settings surfaces stay explicit about code-governed vs runtime-read posture. |
| Full Umbraco technical identity | YELLOW | Workflow/control-plane parity is much closer, but .NET-specific internals remain outside the current stack. |
| `ContentWorkspace.tsx` size | YELLOW | Ownership is cleaner, but the editor runtime component is still larger than ideal. |
