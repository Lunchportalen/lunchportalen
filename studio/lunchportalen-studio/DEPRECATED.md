# Deprecated — do not use for new work

This folder is a **legacy Sanity Studio scaffold** with a **hardcoded** `projectId` in `sanity.config.ts`.

**Canonical Studio** lives at `studio/` (root) and reads `SANITY_STUDIO_PROJECT_ID` / `NEXT_PUBLIC_SANITY_PROJECT_ID` from the environment.

Do not duplicate schema or deploy from this path unless you are explicitly migrating data. Prefer `studio/sanity.config.ts` and env-driven configuration.
