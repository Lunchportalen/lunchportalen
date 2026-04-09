- Title: U36-RC execution log
- Scope: short chronological log for meaningful U36 steps.
- Repro: append after each substantive phase move.
- Expected: concise timeline tied to real code and verification.
- Actual: phase just started.
- Root cause: none.
- Fix: keep the log short and factual.
- Verification: entries align with changed files and tests.

## Log

- Created U36RC steering docs for execution, compat, workspace truth, management objects, property editor system, changed files, and execution log.
- Confirmed remaining U36 targets from code, not only from docs: footer-app ownership, property-editor relation graph, settings object flow, discovery/action consistency, and tree/audit operator payload clarity.
- Added explicit settings object-class and flow-kind metadata, then surfaced that metadata in the shared management frame and settings chrome.
- Rebuilt `backofficeSchemaSettingsModel.ts` into one shared property-editor system read-model and moved settings hub, document types, data types, schema, management-read, and create-policy onto that model.
- Closed footer truth by letting `backofficeWorkspaceContextModel.ts` own grouped footer apps and management shortcuts, and by making `BackofficeWorkspaceFooterApps.tsx` render only canonical footer primitives.
- Strengthened degraded operator UX for tree and audit with `operatorAction` payloads plus UI rendering of concrete next steps.
- Removed `lib/cms/backofficeNavItems.ts` and repointed command-palette / discovery consumers to `backofficeExtensionRegistry.ts`.
- Updated and added focused tests for property-editor system truth, settings routes, workspace footer shortcuts, degraded payloads, and one full-suite timing flake in `contentWorkspaceStability.smoke.test.ts`.
- Verification passed:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build:enterprise`
  - `npm run test:run`
- Wrote final U36 signoff docs: decision, traffic-light matrix, signoff, open risks, and next steps.
