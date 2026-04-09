# U34 Decision

- Title: U34 Bellissima structural closure decision
- Scope: content workspace ownership, shared Bellissima context truth, management workspaces, section discipline, and tree/audit degraded posture.
- Repro:
  1. Open `/backoffice/content`.
  2. Open `/backoffice/content/[id]`.
  3. Open `/backoffice/settings`, `/backoffice/settings/document-types`, `/backoffice/settings/data-types`, and `/backoffice/settings/ai-governance`.
- Expected: one clearer Bellissima-like section -> tree/collection -> workspace line where the host owns snapshots, the shared context owns workspace shell truth, and settings behaves like real management workspaces.
- Actual: achieved by consolidating preview/view state into Bellissima context, moving section ownership to the host, standardizing management workspaces, and hardening degraded tree/audit messaging.
- Root cause: U33 landed the core Bellissima runtime line but left a few compat layers, child-published section truth, and ad hoc management surfaces in place.
- Fix: close the remaining structural gaps instead of adding more local props/state or parallel workspace patterns.
- Verification:
  - Focused U34 vitest pass: PASS
  - Final RC gate rerun: PASS (`typecheck`, `lint`, `build:enterprise`, `test:run`)

## Decision

- Accept U34 as a real runtime closure phase, not a docs/polish pass.
- Keep `ContentWorkspaceHost` as the canonical section/workspace host and keep children on registration-only contracts.
- Keep `ContentBellissimaWorkspaceContext` as the canonical owner of workspace presentation/view shell truth.
- Keep one settings management workspace model/frame instead of separate per-page patterns.
- Keep one tree line and one audit line; make degraded posture more operator-honest instead of introducing new motors.
