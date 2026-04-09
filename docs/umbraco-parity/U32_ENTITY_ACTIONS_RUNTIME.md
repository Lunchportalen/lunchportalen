# U32 - Entity actions runtime

- Title: U32 entity action consolidation
- Scope: `components/backoffice/BellissimaEntityActionMenu.tsx`, `app/(backoffice)/backoffice/content/_tree/NodeActionsMenu.tsx`, `components/backoffice/BellissimaWorkspaceHeader.tsx`, and shared workspace action helpers.
- Repro:
  1. Compare entity actions exposed in the content tree, landing/discovery surfaces, and the detail workspace header.
  2. Observe that labels, ordering, and shared behavior are not fully aligned.
- Expected: entity actions use one consistent language and rendering pattern across surfaces.
- Actual: the same intent existed in several places, but naming and wiring still varied.
- Root cause: entity actions were not yet treated as first-class descriptors in the shared workspace model.
- Fix: extend the Bellissima model with explicit entity actions, make the shared action menu reusable, and align tree action labels with the same workspace language.
- Verification:
  - `npx vitest run tests/cms/bellissimaWorkspaceContext.test.ts tests/cms/backofficeWorkspaceContextModel.test.ts --config vitest.config.ts`
  - `npm run test:run`

## Reused entity actions now

- `edit`
- `preview`
- `history`
- `settings`
- `public_page`
- `copy_link`

## Surfaces aligned in U32

- workspace header via `BellissimaEntityActionMenu`
- content tree node menu via `NodeActionsMenu`
- landing/recent-page affordances through shared workspace action labels

## Result

- Opening a workspace is now explicit in the tree instead of being only an implicit row click story.
- Header and tree now speak a much closer shared Bellissima language.
- U32 still avoids a new mutation engine; the change is structural consistency, not a second action subsystem.
