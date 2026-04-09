# U33 Execution Plan

- Title: U33 Bellissima core rebuild and real structural parity
- Scope: `app/(backoffice)/backoffice/content/**`, `app/(backoffice)/backoffice/settings/**`, `app/api/backoffice/content/**`, `components/backoffice/**`, `lib/cms/**`, and focused CMS/backoffice tests.
- Repro:
  1. Open `/backoffice/content`.
  2. Open `/backoffice/content/[id]`.
  3. Compare current tree, header, workspace views, inspector, footer, history, and settings flows against a Bellissima-style section -> tree -> workspace runtime.
- Expected: one canonical content host, one canonical workspace context, explicit views/actions/footer apps, stable tree/audit degraded truth, and settings as a first-class management section.
- Actual: the active Bellissima line exists, but the editor still carries dead parallel Bellissima files, local rail/view state outside the shared model, duplicate route parsing, and settings surfaces that are more descriptive than operational.
- Root cause: U31/U32 introduced Bellissima-like structure without fully deleting the old parallel shell/context line or fully moving workspace shell state into the canonical context.
- Fix: lock U33 to one host, one context, one route parser, one action language, one settings management posture, and one honest degraded tree/audit story.
- Verification:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build:enterprise`
  - `npm run test:run`

## Frozen Flow Check

- No frozen company lifecycle flow is touched.
- No onboarding, login, billing, order, or runtime truth is moved into CMS.
- Week/menu, company/agreement/location, and operational auth remain on existing runtime truth.

## U33 Structural Gaps To Close Now

- Remove the dead Bellissima stack that still exists beside the active content workspace model.
- Move workspace shell state for side apps and inspector grouping into the canonical shared context.
- Make `/backoffice/content` unambiguously tree-first and keep growth/runtime surfaces out of the content landing.
- Unify route parsing and selection truth for host and tree.
- Make actions explicit at workspace level and keep footer apps persistent and calm.
- Improve settings so collection -> workspace flow feels operational without pretending CRUD exists.
- Harden tree/audit degraded behavior so operators see truthful reasons and safe action posture.
