# U33 Traffic Light Matrix

- Title: U33 traffic light matrix
- Scope: structural parity targets closed in U33.
- Repro: compare U33 runtime against the locked target model.
- Expected: red gaps reduced to green/yellow with no new parallel systems.
- Actual: major control-plane gaps closed; a few parity items remain future work.
- Root cause: U31/U32 laid foundations but did not complete consolidation.
- Fix: U33 closes the core structural/runtime gaps on the current stack.
- Verification:
  - Focused Vitest suite: PASS
  - Final RC gate rerun: PASS (`typecheck`, `lint`, `build:enterprise`)

| Area | Status | Notes |
| --- | --- | --- |
| Canonical content host | GREEN | Host and tree now share one route parser. |
| Shared workspace context | GREEN | Provider now owns side apps and inspector focus, not just snapshot publishing. |
| Workspace views | GREEN | Views remain explicit and are driven by the shared model. |
| Workspace actions | GREEN | Primary/secondary actions moved into the canonical header. |
| Workspace footer apps | GREEN | Footer now stays status-first instead of duplicating action bars. |
| Entity action reuse | GREEN | Shared action language now appears on workspace and content landing. |
| Tree degraded posture | GREEN | `mutationsLocked` fail-closes structural actions during reserve tree mode. |
| Audit degraded posture | GREEN | Invalid filters now return honest `422`; degraded table states stay `200` with operator truth. |
| Settings management flow | GREEN | Document types and governance surfaces are operational collection/workspace flows. |
| Dead Bellissima parallel line | GREEN | Old shell/context/footer/tabs files removed. |
| Topbar overload reduction | YELLOW | Overflow tightened, but section/global navigation can still be simplified further later. |
| Full Umbraco technical identity | YELLOW | Structural/workflow parity increased; .NET-specific internals remain out of stack scope. |
