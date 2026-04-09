# U32 - Decision

- Title: U32 Bellissima structural parity, content workspace host, and real workspace context
- Scope: `backoffice/content`, `backoffice/settings`, shared workspace model/components, content tree/audit routes, focused tests, and the U32 documentation pack.
- Repro: The backoffice had Bellissima-like visuals, but content host ownership, workspace context, view/action/footer modeling, entity actions, and degraded tree/audit posture were still fragmented.
- Expected: one canonical content host, one real shared workspace context, explicit views/actions/footer apps, calmer preview/inspector hierarchy, honest tree/audit posture, and a clearer settings management section.
- Actual before U32: the active provider/model line existed, but it was still partial; `/backoffice/content` was not a strong content-first entry, and host/view/action truth remained split across local props and wrappers.
- Root cause: route identity, workspace identity, and editor-local UI mechanics evolved in parallel rather than being consolidated into one control-plane model.
- Fix: build the canonical content host, expand the Bellissima workspace model, wire header/footer/actions/entity actions through that model, restore content-first landing behavior, harden tree/audit degraded truth, rebalance preview/inspector layout, and align settings to a stronger collection/workspace posture.
- Verification:
  - `npm run typecheck` -> PASS
  - `npm run lint` -> PASS
  - `npx vitest run tests/backoffice/content-page-smoke.test.tsx tests/cms/bellissimaWorkspaceContext.test.ts tests/cms/backofficeWorkspaceContextModel.test.ts tests/cms/backofficeExtensionRegistry.test.ts tests/cms/mapTreeApiRoots.test.ts tests/api/contentAuditLogRoute.test.ts --config vitest.config.ts` -> PASS
  - `npm run test:run` -> PASS
  - `npm run build:enterprise` -> PASS
  - `npm run sanity:live` -> PASS (soft gate; localhost health endpoint not reachable, script exited cleanly)

# 1. Endelig beslutning

- GO WITH CONDITIONS

U32 is accepted. The content backoffice is now materially more coherent and much closer to Bellissima in structure, but it is not yet a full Umbraco 17-grade platform across every management surface.

# 2. Hva som er oppnådd

## Hvordan CMS nå fungerer som hovedbase

- Content is now a real control-plane section with one canonical landing route and one canonical detail workspace route.
- The section now reads as section -> tree -> workspace instead of dashboard -> editor drift.
- The canonical host is `ContentWorkspaceHost`, mounted at the content section layout.

## Hvilke domener som faktisk snakker med CMS

- editorial content/pages and public-page composition
- media-linked page building inside the content workspace
- content tree and page discovery inside the backoffice
- settings/governance surfaces for document types, data types, schema, management read, and system/drift posture
- editorial AI/operator assists inside the content workspace
- SEO/growth review surfaces that remain review-oriented
- company/agreement/location review/control surfaces that already route through the broader control plane
- operational week/menu governance through the existing CMS publish chain

## Hvordan ukemeny/ukeplan publiseres via CMS

- U32 did not introduce a new week/menu truth.
- `operational_week_menu_governance` remains `LIVE` in `moduleLivePosture`.
- Menypublisering continues through the existing Sanity Studio source that runtime already reads.
- `weekplan_editorial` remains `LIMITED` and editorial-only; it is not promoted into operational order truth by U32.

## Hvordan sections/trees/workspaces nå er modellert

- Sections now expose clearer workspace posture through shared registry metadata.
- `/backoffice/content` is the canonical section landing.
- `/backoffice/content/[id]` is the canonical content workspace detail route.
- The tree remains the primary navigation truth for content entities.

## Hvordan workspace context nå fungerer

- One shared Bellissima context now carries entity/section identity, title, slug, document type, publish state, governed posture, preview/runtime posture, active view, actions, entity actions, and footer apps.
- `MainViewContext` is now compatibility-only; active workspace view truth lives in the shared Bellissima context.

## Hvordan workspace views/actions/footer apps nå fungerer

- Explicit entity views now exist for `content`, `preview`, `history`, `global`, and `design`.
- Explicit section views now exist for `overview`, `growth`, and `recycle-bin`.
- Primary and secondary actions are model-driven and rendered through shared header/save/footer surfaces.
- Footer apps now behave as a real persistent status zone instead of only scattered badges.

## Hvordan settings nå fungerer som seksjon

- Settings now reads more clearly as a management section driven by shared collection/workspace metadata.
- The section is explicit about code-governed posture where persisted CRUD does not exist.

# 3. Hva som fortsatt er svakt

## Konkrete åpne plattform-risikoer

- Bellissima parity is strong inside content, but not yet uniform across every management module.
- Settings is structurally clearer, but document/data type management is still code-governed rather than fully persisted CRUD.
- Unified history/governance parity still exists mainly for content, not as a cross-module platform layer.
- Discovery/quick-find parity is still weaker than in full Umbraco Bellissima.
- Repo-wide lint warnings still exist outside U32 scope.

## Konkrete moduler som fortsatt er LIMITED / DRY_RUN / STUB / INTERNAL_ONLY

- `weekplan_editorial` -> `LIMITED`
- `social_calendar` -> `LIMITED`
- `seo_growth` -> `LIMITED`
- `esg` -> `LIMITED`
- `social_publish` -> `DRY_RUN`
- `worker_jobs` -> `STUB`
- `cron_growth_esg` -> `INTERNAL_ONLY`

# 4. Hvor nær systemet er Umbraco 17-/verdensklasse-nivå

- For the content workspace vertical, the repo is now near-Umbraco in structure: host, shared context, explicit views, explicit actions, and footer apps are materially real.
- For the whole platform, it is not yet full Umbraco 17 parity because the extension runtime, discovery story, cross-module history model, and type-management workflow are still custom and uneven.
- In plain terms: near-Umbraco 17 parity inside the content workspace line, but not yet across the full backoffice platform.

# 5. Hva som må lukkes før ubetinget enterprise-live-ready

- Run browser-level smoke coverage for tree -> workspace -> history -> preview transitions.
- Decide and document whether document/data types stay code-governed or move to a persisted management flow.
- Reduce remaining repo-wide lint warning noise that can hide future regressions.
- Validate `sanity:live` against a reachable running environment, not only the soft local skip path.
- Continue normalizing Bellissima structure across adjacent management modules so content is no longer the lone strong vertical.

# 6. Hva som kan vente til senere

- Full Umbraco-style extension manifest/runtime parity
- deeper quick-find/discovery parity
- cross-module history/governance platform work
- broader Bellissima unification outside the content/settings scope
- optional UX refinements that do not change the control-plane model
