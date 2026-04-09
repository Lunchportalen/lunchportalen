# Source-to-target migration manifest

## 1. Purpose

The **migration manifest** is the **contract** between legacy sources and Umbraco. **No field may disappear silently.** Every legacy field family has a row (or explicit grouping row) with disposition, transform, validation, owner, and confidence.

**Authoritative field semantics:** [`../phase-2-3/25-field-disposition-register.md`](../phase-2-3/25-field-disposition-register.md) and [`../phase-2-3/field-disposition-register.csv`](../phase-2-3/field-disposition-register.csv). This document **extends** that register with ETL-level columns; where they conflict, **reconcile via change control** before signoff.

## 2. Column schema (required per row)

| Column | Description |
|--------|-------------|
| **source_system** | Postgres / body JSON / resolved media / code registry / (optional Sanity gap-fill) |
| **source_entity_field** | Table.column or JSON path or block field |
| **target_umbraco_type_property** | Document Type / Element Type alias + property alias (or “N/A” if DROP) |
| **transform_rule** | Exact rule: copy, map enum, parse blocks, resolve media id→UDI, merge canonical+duplicate, etc. |
| **required_validation** | Automated check + human gate (e.g. slug regex, block type in allowlist, media exists) |
| **disposition** | `migrate` / `skip` / `manual_review` / `out_of_scope` |
| **owner** | Role name (e.g. Migration lead, Solution architect, Editorial lead) |
| **confidence** | High / Medium / Low |

## 3. Manifest rows — page + variant shell

| source_system | source_entity_field | target_umbraco_type_property | transform_rule | required_validation | disposition | owner | confidence |
|---------------|---------------------|------------------------------|----------------|---------------------|-------------|-------|------------|
| Postgres | `content_pages.id` | N/A | Store in **migration mapping table** only (legacy id → Umbraco key); not a public property | Mapping row created once | migrate (mapping) | Migration lead | High |
| Postgres | `content_pages.title` | `webPage.pageTitle` (culture) | Copy string; trim whitespace | Non-empty for published pages per policy | migrate | Editorial lead | High |
| Postgres | `content_pages.slug` | `webPage.slug` (culture) | Copy; apply Umbraco uniqueness policy | Unique per parent + culture; reserved path check | migrate | Solution architect | High |
| Postgres | `content_pages.tree_parent_id` | Document parent in Umbraco tree | Map via parent legacy id → Umbraco key | Parent exists or root policy | migrate | Migration lead | High |
| Postgres | `content_pages.tree_root_key` | Folder / root placement | Map `home`/`global`/… per Phase 2–3 tree spec | Allowed root for document type | migrate | Solution architect | High |
| Postgres | `content_pages.tree_sort_order` | Umbraco sort order | Numeric copy | Monotonic per sibling group | migrate | Migration lead | High |
| Postgres | `content_pages.page_key` | `webPage.pageKey` or `appShellPage.*` | Copy or route to overlay type **only if B1 resolved** | Type matches manifest | manual_review if B1 open | Product owner | Medium |
| Postgres | `variant.locale` | Culture variant | Map `nb`/`en` → Umbraco culture **per signed locale policy (B2)** | Culture exists on site | migrate | CTO + Product | High once B2 closed |
| Postgres | `variant.environment` | N/A | **Do not** migrate as content field | N/A | skip | Migration lead | High |
| Postgres | `content_pages.status` | N/A | Derive **initial** Workflow state only for import script; ongoing state is Umbraco | No parallel app publish after cutover | skip (post-cut) | Platform admin | High |
| JSON envelope | `documentType` | Document Type alias | Map legacy alias → Umbraco alias 1:1 table | Alias in allowlist | migrate | Lead developer | High |
| JSON envelope | `fields` (generic) | Named DT properties | **Per-key** sub-rows required in `migration-manifest.csv`; no anonymous bag | Each key accounted | migrate / manual_review | Lead developer | Medium |

## 4. Manifest rows — body blocks

| source_system | source_entity_field | target_umbraco_type_property | transform_rule | required_validation | disposition | owner | confidence |
|---------------|---------------------|------------------------------|----------------|---------------------|-------------|-------|------------|
| JSON | `body.blocks[]` | Block editor root on `webPage` | Parse array; map each `type` → Element Type; map nested fields per block schema | Each `type` ∈ **closed inventory** (B3) or quarantined | migrate / manual_review | Migration lead | Medium until B3 closed |
| JSON | `blocks[].id` | N/A | Drop; optional store in migration sidecar for debugging only | N/A | skip (public) | Migration lead | High |
| JSON | `blocks[].type` | Element Type alias | Registry map + plugin map | Known type | migrate | Lead developer | Medium |
| JSON | `blocks[].config` | Design/token properties per `elDesignHints` | Per-block rules in CSV appendix | No forbidden tokens | migrate / manual_review | Solution architect | Medium |
| Various blocks | `*imageId*`, URLs | Media Picker | Resolve to binary → upload/import Media; attach UDI | Media Delivery resolvable; alt policy per `55` | migrate | Migration lead | High |

## 5. Manifest rows — SEO / social / intent / CRO

| source_system | source_entity_field | target_umbraco_type_property | transform_rule | required_validation | disposition | owner | confidence |
|---------------|---------------------|------------------------------|----------------|---------------------|-------------|-------|------------|
| JSON | `body.meta.seo.*` | Page SEO property group | Flatten per `cmsPageMetadata` semantics | Required fields for indexable pages | migrate | Editorial lead | High |
| JSON | `body.meta.seo.canonical` + duplicates | Single **Canonical** property | **MERGE** per disposition register | Valid URL or empty | migrate | Solution architect | High |
| JSON | `body.meta.social.*` | OG/Twitter properties | Copy | OG image resolves | migrate | Editorial lead | High |
| JSON | `body.meta.intent.*` | Optional editorial intent group | Copy | No PII leakage | migrate | Editorial lead | Medium |
| JSON | `body.meta.cro.*` | Optional CRO hints | Copy | Same | migrate | Editorial lead | Medium |
| JSON | `body.meta.diagnostics` | N/A | Drop | N/A | skip | Migration lead | High |
| JSON | `body.meta.seoRecommendations` | N/A or comment-only | Default **DROP**; optional import as internal editor note **only** if product allows | Human review | manual_review / skip | Editorial lead | Medium |

## 6. Catch-all policy

- **Forbidden:** a single “RawBodyJson” Textarea as production authority.
- **Allowed:** temporary staging-only dump **outside** Delivery-visible properties for engineering diff — must be **deleted** before go-live and **never** in published channel.

## 7. Machine-readable excerpt

See [`migration-manifest.csv`](./migration-manifest.csv) for a **subset** of rows; the **markdown tables above + disposition register** remain normative until CSV is complete row-for-row.

## 8. Signoff

Manifest is **complete** when:

1. Every row in `field-disposition-register` maps to ≥1 manifest row or explicit **group** row covering it.
2. **Plugin block inventory (B3)** is closed or each unknown type has a **manual_review** quarantine path.
3. **B1** resolved or **appShellPage** rows are **excluded** with written deferral.
