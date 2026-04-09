# U35RC Execution Log

- Title: U35RC execution log
- Scope: short chronological log of meaningful U35RC milestones.
- Repro: read top to bottom.
- Expected: concise build log, not diary text.
- Actual: log starts at steering-doc creation.
- Root cause: runtime execution has not landed yet.
- Fix: append only meaningful architecture, runtime, and verification milestones.
- Verification: log matches real code and commands.

## Log

- Started from green U34 baseline and existing Bellissima runtime line.
- Read U33/U34 closeout docs, current content host/context files, settings management files, registry, tree, and audit files.
- Read official Umbraco docs for collection views, workspace context, workspace views, workspace footer apps, entity actions, property editor schema, and property editor integration.
- Confirmed U35RC closure targets: converge host/entity publish truth, remove inspector/view compat vocabulary, move more settings surfaces onto one management object model, and align actions/collections/degraded posture more strongly with Bellissima primitives.
- Added explicit section and entity publication scopes to the Bellissima workspace provider so section landing and entity editor no longer compete for one live snapshot.
- Removed the live `legacyPageTab` path and rewired inspector shell, chrome props, and properties rail to the canonical inspector-section model.
- Removed the U32 `ContentWorkspaceLayout` wrapper and moved the last direct dependency onto `ContentWorkspaceHost`.
- Rebuilt the settings overview as a management workspace and moved governance-usage plus system/drift surfaces onto the shared management workspace frame/model.
- Removed the duplicate settings nav-group registry/export path so settings navigation truth lives in one collection model.
- Centralized history-status tone mapping and removed the extra audit-status truth line from the content history timeline, leaving page-level audit responses as detail rather than a competing status system.
- Aligned document-type and data-type collection cards with the canonical workspace open-action label so settings collections and content actions speak the same Bellissima language.
- Verification landed green on `typecheck`, `lint`, direct RC `next build`, `test:run`, and the three SEO gates; `sanity:live` soft-skipped because no reachable app URL was available on the host.
- Wrote the U35RC final closeout docs: decision, traffic-light matrix, signoff, open risks, and next steps.
