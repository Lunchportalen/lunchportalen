# Migration scope and boundary

## 1. In-scope source systems (migrated CMS content)

| Source system | Role | Primary artifacts |
|---------------|------|---------------------|
| **Postgres** | **Primary** current truth for app-backed CMS pages | `content_pages`, `content_page_variants`, `body` JSON (blocks, meta, envelope) |
| **Application media resolution** | References embedded in blocks (`imageId`, URLs, `cms:*` patterns) | Resolved during ETL to Umbraco Media per Phase 2–3 + Phase 4 Media contract |
| **Content tree semantics** | Virtual roots and ordering | `tree_parent_id`, `tree_root_key`, `tree_sort_order`, `page_key` per field disposition |
| **Block registries (code)** | Semantic mapping for core + plugin blocks | `lib/cms/blocks/registry.ts`, `lib/cms/backofficeBlockCatalog.ts` — **types** must map to Element Types already designed in Phase 2–3 |

## 2. Out-of-scope source systems (for CMS migration)

| Source | Treatment |
|--------|-----------|
| **Sanity `menuContent` and operational menu** | **MOVE OUT OF CMS** — not migrated as Umbraco editorial pages |
| **Orders, week plans, tenants, billing, immutable logs** | Application domain — **no** Umbraco Document Types for these in this program |
| **Application user profiles / company RBAC** | Not editorial identities in Umbraco |
| **AI diagnostics / stale recommendations in `body.meta`** | Per disposition: **DROP** or non-authoritative re-generation in Umbraco (not default migrate) |

**Parallel/historical Sanity pages:** where Postgres is current for marketing pages, Sanity page content is **not** a second authority for ETL; use only if explicitly needed for **gap fill** with **manual review** row in manifest.

## 3. Content types covered now (migratable families)

Aligned with Phase 2–3 **document type matrix** (see [`../phase-2-3/21-document-type-matrix.md`](../phase-2-3/21-document-type-matrix.md) and `content-type-matrix.csv`):

- **`webPage` / `webPageHome`** (and related folder/container types holding them).
- **`siteSettings`** and other **settings** document types defined in Phase 2–3.
- **`redirectRule`** (or equivalent) if modeled as editorial Umbraco content.
- **Element Types** backing **block grid/list** for in-scope blocks only.

## 4. Content types explicitly deferred or decision-dependent

| Item | Reason |
|------|--------|
| **`appShellPage` / overlays subtree (B1 / PB1)** | Authority split (Umbraco vs app) **unset** — migration manifest **cannot** be final for this family until decided |
| **`webLandingPage`** | Only if product retains distinct type vs `webPage` |
| **Sanity `announcement` / driftsmelding** | Requires product decision: operational vs `siteSettings` / alert block — **not** assumed in default ETL |

## 5. Fields or entities moved out of CMS scope

Per Phase 2–3 disposition register:

- **`content_pages.status`** as app authority → **DROP**; Umbraco publish + Workflow is truth after cutover.
- **`variant.environment`** as stored discriminator → environments are **deployment** concern, not migrated as legacy column semantics.
- **Block instance `id`** → new Umbraco identities; mapping is **positional + hash** per ETL design, not preserved as public IDs unless explicitly required (default: no).
- **`body.meta.diagnostics`**, **`body.meta.seoRecommendations`** (default) → **DROP** or **manual review** only — no silent carry of stale AI output.

## 6. Anti–scope-creep rules

1. **No new “misc JSON” property** in Umbraco to absorb unmigrated legacy without ADR + manifest row + approver signoff.
2. **No operational tables** imported “for convenience” into CMS.
3. **No dual write** after cutover for migrated types (see `56`).
4. **ETL must not “fix” copy** — normalization rules are **documented**; editorial quality fixes happen in Umbraco **post-load** under Workflow.

## 7. Legacy write path (definition)

Any **mutation** to `content_pages` or `content_page_variants` (insert/update/delete/publish workflow transitions) that **changes** editorial state for a **migrated** content family, including:

- HTTP API routes under `app/api/backoffice/content/**` that upsert pages/variants, publish variants, move tree, batch-normalize, build/publish home, etc.
- **Backoffice UI** actions that call those APIs.
- **Scripts, jobs, or SQL** that write the same tables for editorial purposes.

**Freeze** means these paths are **disabled or guarded** for migrated types/environments per `56`.

## 8. Legacy read path (definition)

Any **read** used for **parity diff**, **audit**, **rollback analysis**, or **time-bounded migration fallback** (explicitly allowed only as **temporary** per Phase 4 “no permanent dual-read”):

- Same APIs in **read-only** mode or direct **SELECT** from replica.
- **Not** exposed to public site after cutover for migrated types (published truth = Delivery API per Phase 4).
