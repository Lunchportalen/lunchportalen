# Umbraco migration — Phase 2 and Phase 3 pack

This folder contains **execution-grade** design artifacts for **Phase 2** (content model + semantic mapping) and **Phase 3** (editorial backoffice / workspace design) of the **headless Umbraco on Umbraco Cloud + Next.js shell** program.

Phase 2 and Phase 3 were produced **in parallel**; cross-references between files are intended to **reconcile** (same block names, same document type aliases, same RBAC story).

## Hard boundary (program law)

- **In scope here:** editorial semantics for **public website CMS content** and its **Umbraco-native** representation; editor-facing Umbraco backoffice shape; stock vs custom extension decisions.
- **Out of scope here:** preview implementation, Delivery API integration code, ETL, cutover, runtime Next changes, content migration execution, production IA invented without source support.

**Operational data** (menu, menuContent, weekPlan, orders, tenants, billing, immutable logs, etc.) is **not** modeled in Umbraco per locked premises.

## Phase mapping

| Phase | Focus | Primary files |
|-------|--------|----------------|
| **2** | Document Types, Element Types, Data Types, Media, fields, navigation/SEO/settings model | `20`–`26`, CSVs |
| **3** | Content tree, workspace views, dashboards, sections, property editors, journeys, RBAC + Workflow | `30`–`39`, CSVs |

## Upstream dependency

- **Phase 0–1:** [../phase-0-1/00-README.md](../phase-0-1/00-README.md) (ADR, authority matrix, scope, Workflow mandate, API Users, AI model).

## Artifact index

| File | Purpose |
|------|---------|
| [20-content-model-master.md](./20-content-model-master.md) | Phase 2 master — principles, scope, relationships, anti-patterns |
| [21-document-type-matrix.md](./21-document-type-matrix.md) | One row per document type candidate |
| [22-element-types-and-block-taxonomy.md](./22-element-types-and-block-taxonomy.md) | Block / element type strategy |
| [23-data-type-register.md](./23-data-type-register.md) | Data Types for field families |
| [24-media-localization-and-dictionary-model.md](./24-media-localization-and-dictionary-model.md) | Media Types, variants, dictionary |
| [25-field-disposition-register.md](./25-field-disposition-register.md) | Legacy field disposition (KEEP/MERGE/SPLIT/DROP/MOVE…) |
| [26-navigation-seo-and-settings-model.md](./26-navigation-seo-and-settings-model.md) | Nav, SEO, settings ownership |
| [30-editorial-backoffice-master.md](./30-editorial-backoffice-master.md) | Phase 3 master — principles, stock-first, Workflow fit |
| [31-content-tree-and-editorial-structure.md](./31-content-tree-and-editorial-structure.md) | Site root, folders, editor IA |
| [32-workspace-views-dashboards-sections.md](./32-workspace-views-dashboards-sections.md) | Workspace Views / Dashboards / Sections — keep vs reject |
| [33-property-editor-strategy.md](./33-property-editor-strategy.md) | Stock vs custom Property Editors |
| [34-editor-journeys.md](./34-editor-journeys.md) | End-to-end editor journeys + acceptance criteria |
| [35-rbac-workflow-editor-matrix.md](./35-rbac-workflow-editor-matrix.md) | Groups, Workflow stages, permissions |
| [36-phase-2-3-decision-log.md](./36-phase-2-3-decision-log.md) | Decision log |
| [37-open-questions-and-blockers.md](./37-open-questions-and-blockers.md) | Real blockers only |
| [38-phase-2-exit-checklist.md](./38-phase-2-exit-checklist.md) | Phase 2 binary gate |
| [39-phase-3-exit-checklist.md](./39-phase-3-exit-checklist.md) | Phase 3 binary gate |

### Optional structured files

| File | Purpose |
|------|---------|
| [content-type-matrix.csv](./content-type-matrix.csv) | Document type matrix (machine-readable) |
| [block-taxonomy.csv](./block-taxonomy.csv) | Block / element taxonomy |
| [field-disposition-register.csv](./field-disposition-register.csv) | Field disposition |
| [rbac-workflow-editor-matrix.csv](./rbac-workflow-editor-matrix.csv) | RBAC × Workflow |

## Intentionally deferred (later phases)

- Delivery API consumption patterns in Next (ISR, revalidation, caching).
- Preview URL contract and implementation.
- ETL mapping jobs, redirect catalog execution, cutover runbooks.
- Full plugin block inventory reconciliation (beyond core registry) unless explicitly run as Phase 2 task.
- SSO / external login for Umbraco backoffice (may be manual platform work per Phase 0–1).

## Source systems used for mapping (read in repo)

- Application CMS: `content_pages`, `content_page_variants` (incl. `body` JSON shape, tree columns).
- Code: `lib/cms/contentDocumentTypes.ts`, `lib/cms/blocks/registry.ts`, `lib/cms/bodyEnvelopeContract.ts`, `lib/cms/model/pageAiContract.ts`, `lib/cms/public/cmsPageMetadata.ts`, `lib/cms/contentTreeRoots.ts`.
- Legacy Sanity studio: `studio/schemaTypes/*` (not primary truth for current Postgres-backed pages; relevant for historical/parallel types).
- Docs: `docs/umbraco-migration/phase-0-1/*`, `docs/phase2d/SEO_SOURCE_OF_TRUTH.md`, `docs/backoffice/UMBRACO_TREE_SPEC.md`.
