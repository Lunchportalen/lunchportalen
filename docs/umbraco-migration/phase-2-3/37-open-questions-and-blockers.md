# Open questions and blockers

**Only items that prevent Phase 2 or Phase 3 design sign-off** (no filler).

| ID | Issue | Why it blocks |
|----|-------|----------------|
| **B1** | **`appShellPage` / `overlays` subtree** — Umbraco editorial with separate Delivery channel vs **remain in application** | Document Types, tree, RBAC, and “no legacy editor dependency” cannot be finalized for overlay pages. |
| **B2** | **Public locale strategy (`en`)** — workflow API allows `en`; public Next render path uses **`nb`** only | Culture list, variant completeness rules, and URL strategy for Phase 4 are ambiguous. |
| **B3** | **Full plugin block inventory** — persisted block types beyond `CORE_RENDER_BLOCK_TYPES` | Element Type set and ETL cannot be signed complete. |
| **B4** | **Umbraco Workflow proof on staging** (Phase 1 dependency) | Cannot honestly claim governance parity in Phase 3 exit until Workflow is enabled and stages match `35-rbac-workflow-editor-matrix.md`. |

**Resolved elsewhere (not blockers for model design):** Delivery API keys, preview URLs, webhook code — Phase 4.
