- Title: U36-RC compat removal plan
- Scope: remove or box in the remaining files and patterns that still compete with canonical workspace, registry, or management truth.
- Repro: inspect imports and live rendering for command palette, workspace footer/header, settings workspaces, and content editor helpers.
- Expected: one obvious owner per concern.
- Actual: a few barrels, shims, and footer-only recompositions still survive.
- Root cause: earlier rescue phases kept safe compatibility surfaces to keep the repo green while larger ownership moves landed.
- Fix: delete or neutralize the remaining low-value compat layers now that the canonical models exist.
- Verification: no remaining runtime consumers depend on removed compat files; tests point at canonical files.

## U36RC Compat Targets

- Remove `lib/cms/backofficeNavItems.ts` as a live compatibility barrel and move remaining imports to `lib/cms/backofficeExtensionRegistry.ts`.
- Remove `app/(backoffice)/backoffice/content/_components/ContentWorkspaceActions.ts` if it remains unused; otherwise keep only as an explicit no-behavior transitional shell with zero truth.
- Stop recomputing footer-visible workspace truth inside `BackofficeWorkspaceFooterApps.tsx`; render canonical footer apps from the workspace model only.
- Stop treating management-read/schema pages as hand-written explanations when the same truth can be emitted from one shared property-editor/system model.
- Keep `contentWorkspaceWorkspaceRootImports.ts` only if it remains a zero-logic import surface; do not let it become an ownership layer.
