# U32 - Content section runtime

- Title: U32 content-first section model
- Scope: `app/(backoffice)/backoffice/content/page.tsx`, `app/(backoffice)/backoffice/content/_workspace/ContentSectionLanding.tsx`, `app/(backoffice)/backoffice/content/layout.tsx`, and shared content-section chrome.
- Repro:
  1. Open `/backoffice/content`.
  2. Observe that the route can drift toward dashboard semantics instead of acting like the primary content entry.
  3. Observe that tree, create, recent content, and settings/governance links are not clearly framed as one section-first control surface.
- Expected: `/backoffice/content` is the canonical content landing, tree-first, calm, and clearly routes the editor toward detail workspaces.
- Actual: the route had grown into a mixed landing/dashboard surface and did not strongly communicate section -> tree -> workspace ownership.
- Root cause: content landing logic had evolved locally instead of being governed by the same host/context model as the editor runtime.
- Fix: restore `/backoffice/content` as a content-first landing, mount it under the canonical content host, and publish an explicit section-level Bellissima workspace snapshot for overview/create/settings flows.
- Verification:
  - `npx vitest run tests/backoffice/content-page-smoke.test.tsx --config vitest.config.ts`
  - `npm run typecheck`
  - `npm run build:enterprise`

## What changed

- `app/(backoffice)/backoffice/content/page.tsx` now points to `ContentSectionLanding` instead of the older dashboard path.
- `ContentSectionLanding.tsx` now behaves as a real section overview with:
  - one clear H1
  - explicit create action
  - recent pages fed from the existing pages API
  - clear settings/media linking
  - Bellissima section snapshot publishing through the shared workspace context
- `app/(backoffice)/backoffice/content/layout.tsx` now mounts the canonical host so the landing and detail routes share the same structural frame.

## Canonical section posture now

- Canonical landing route: `/backoffice/content`
- Primary navigation truth: tree first, then workspace detail
- Create entry: explicit workspace action, not a floating local affordance
- Governance/settings routing: explicit links to `/backoffice/settings` and adjacent management surfaces
- Growth/dashboard drift: removed from the main landing posture; the landing is now overview-oriented rather than analytics-led

## Result

- Content now reads as a first-class management section instead of a mixed dashboard.
- The landing page is structurally aligned with Bellissima intent without introducing a second shell or parallel content router.
- The section now publishes the same shared workspace language as detail workspaces, which reduces route-to-route drift.
