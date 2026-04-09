# Field disposition register

Classifies **legacy fields** into **KEEP / MERGE / SPLIT / DROP / MOVE …** for Umbraco. Sources: `content_pages`, `content_page_variants`, body shape (`blocks`, `meta`, envelope), block types in `lib/cms/blocks/registry.ts`, `lib/cms/model/pageAiContract.ts`.

| Source field | Source system | Current meaning | Disposition | Target in Umbraco | Rationale | Confidence |
|--------------|---------------|-----------------|-------------|-------------------|-----------|------------|
| `content_pages.id` | Postgres | Primary key | **DROP** (legacy) | N/A after cutover | Umbraco node key replaces | High |
| `content_pages.title` | Postgres | Page title | **KEEP** | `webPage` culture property `pageTitle` | H1 + default SEO | High |
| `content_pages.slug` | Postgres | URL segment | **KEEP** | `webPage` culture `slug` | Routing | High |
| `content_pages.status` | Postgres | draft/published | **DROP** as app authority | **Umbraco publish state + Workflow** | Single governance plane | High |
| `content_pages.tree_parent_id` | Postgres | Tree parent | **KEEP** (semantic) | Document parent in Umbraco tree | Structure | High |
| `content_pages.tree_root_key` | Postgres | Virtual root bucket | **KEEP** (semantic) | Parent folder / root policy | Maps `home`, `global`, … | High |
| `content_pages.tree_sort_order` | Postgres | Sibling order | **KEEP** | Sort order / explicit `sortOrder` | Nav | High |
| `content_pages.page_key` | Postgres | Semantic kind / binding | **MERGE** or **MOVE** | `webPage` invariant `pageKey` **or** separate Document Type | Overlays may need **`appShellPage`** | Medium |
| `variant.locale` | Postgres | `nb` / `en` | **KEEP** | Culture variant | | High |
| `variant.environment` | Postgres | prod/staging/preview | **DROP** as stored field | **Umbraco env** + Delivery endpoints | Environments are deployment concern | High |
| `body.blocks[]` | JSON | Block list | **SPLIT** | Block editor + Element Types | No blob | High |
| `body.meta.seo.*` | JSON | SEO | **KEEP** | Properties on page or `elSeo` composition | Matches `cmsPageMetadata` | High |
| `body.meta.seo.canonical` + `canonicalUrl` | JSON | Duplicate canonical | **MERGE** | Single **Canonical** property | Redundant today | High |
| `body.meta.social.*` | JSON | OG/Twitter overrides | **KEEP** | `webPage` properties group | | High |
| `body.meta.intent.*` | JSON | Editorial intent | **KEEP** | Optional property group | Used by AI tools in app; in Umbraco **editorial** context | Medium |
| `body.meta.cro.*` | JSON | CRO hints | **KEEP** | Optional property group | | Medium |
| `body.meta.diagnostics` | JSON | Last-run AI diagnostics | **DROP** | Not migrated | Operational telemetry; not public content | High |
| `body.meta.seoRecommendations` | JSON | Persisted SEO suggestions | **DROP** or **MOVE** | Regenerate in Umbraco AI context | **No silent carry** of stale suggestions — optional import as **comment** only | Medium |
| `documentType` (envelope) | JSON | Page kind | **KEEP** | Umbraco Document Type alias | Envelope goes away; type is native | High |
| `fields` (envelope) | JSON | Extra page fields | **MAP 1:1** | Named properties | Must inventory keys in ETL | Medium |
| `blocksBody` as string | JSON | Legacy string body | **SPLIT/PARSE** | RTE block or discard | Rare path | Low |
| Block `id` | JSON | Stable block id | **DROP** | Umbraco block UDI | New identities; map via migration script ordering | High |
| Block `type` | JSON | Discriminator | **MAP** | Element Type alias | | High |
| Block `config` | JSON | Design tokens | **KEEP** if used | Block-level properties or **shared** `elDesignHints` | Inspect per type | Medium |
| `hero.imageId` / `imageId` strings | Block | cms:* / uuid / URL | **MOVE TO MEDIA** | Media Picker | Resolve to Media Library on import | High |
| `hero_bleed.ctaPrimaryHrefKind` | Block | internal/external hint | **DROP** | URL Picker handles | Editor-only today | High |
| `pricing.plans[]` empty | Block | Signal live pricing | **KEEP** semantics | `elPricing` with zero plans | Next continues API-driven pricing | High |
| `relatedLinks.currentPath` | Block | Match key | **KEEP** | Textstring | Until Delivery provides path context automatically | Medium |
| `form.formId` | Block | HubSpot/etc. id | **KEEP** | `elFormEmbed` | Still app-resolved at render | High |
| Sanity `page.title/slug/content` | Sanity | Old marketing page | **DROP** for pages migrated to Postgres | `webPage` | **Postgres is current** for app CMS pages | High |
| Sanity `menuContent.*` | Sanity | Operational menu | **MOVE OUT OF CMS SCOPE** | Operational store | Program lock | High |
| Sanity `announcement.*` | Sanity | Driftsmelding | **MOVE OUT OF CMS SCOPE** or **separate product** | If public banner: **`siteSettings` or `elAlert`** — **decide** | Not in `content_pages` model today | Medium |

---

*See also:* [field-disposition-register.csv](./field-disposition-register.csv)
