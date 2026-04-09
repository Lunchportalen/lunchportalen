# U33 Decision

- Title: U33 Bellissima core rebuild decision
- Scope: content host, workspace context, views/actions/footer apps, tree/audit posture, and settings management surfaces.
- Repro:
  1. Open `/backoffice/content`.
  2. Open `/backoffice/content/[id]`.
  3. Open `/backoffice/settings`, `/backoffice/settings/document-types`, and `/backoffice/settings/governance-insights`.
- Expected: one Bellissima-like control plane line with tree-first navigation, shared workspace shell state, explicit actions/footer apps, and honest management posture.
- Actual: achieved by consolidating route truth, provider state, action placement, settings surfaces, and degraded runtime posture.
- Root cause: previous phases introduced parity primitives but left dead parallel files and local shell state in place.
- Fix: remove dead parallel files, route all shell consumers through the shared model, harden degraded truth, and make settings operational.
- Verification:
  - Focused Vitest suite: PASS
  - Final RC gate rerun: PASS (`typecheck`, `lint`, `build:enterprise`)

## Decision

- Accept U33 as a real runtime phase, not a docs-only phase.
- Keep `ContentWorkspaceHost` as canonical content host and `ContentBellissimaWorkspaceContext` as canonical shared model.
- Keep one tree engine and one audit route; harden them instead of building new motors.
- Keep settings code-governed and honest about where explicit mutation exists.
- Delete the dead Bellissima shell/context/footer/tabs line and old tree/audit compat helpers now.
