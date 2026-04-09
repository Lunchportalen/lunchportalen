# Legacy Sanity Studio entry (deprecated path)

**Canonical Studio** for this repo lives in **`/studio`** (env-based `projectId` / `dataset`, `deskTool`, shared `schemaTypes`).

This folder kept a standalone Vite-era layout with a **hardcoded** `projectId` in `sanity.config.ts`. Do not use it for new work or deploys unless you explicitly reconcile IDs with `SANITY_STUDIO_PROJECT_ID` / `NEXT_PUBLIC_SANITY_PROJECT_ID`.

Prefer: `cd studio && npm run dev` (see root `package.json` scripts).
