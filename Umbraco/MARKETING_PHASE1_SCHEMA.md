# Marketing phase 1 — Umbraco schema (Lunchportalen)

This describes the **minimum** Umbraco model for dual-read with Next.js (`LP_MARKETING_CMS_SOURCE=umbraco`).  
Create types in the Umbraco backoffice, then **export with uSync** (package `uSync` 17.x is referenced from `UmbracoTest.csproj`) so `uSync/` is populated under the site root.

## Document type: `marketingPage`

| Property alias   | Type              | Notes |
|------------------|-------------------|--------|
| `pageTitle`      | Textstring        | Maps to `ContentBySlugResult.title` |
| `routeSlug`      | Textstring        | Lowercase slug; must match Next allowlist (`home` or `LP_MARKETING_UMBRACO_EXTRA_SLUG`) |
| `bodyBlocks`     | Block List        | Allowed element types only (see below) |
| `seoTitle`       | Textstring        | → `body.meta.seo.title` |
| `seoDescription` | Textarea          | → `body.meta.seo.description` |
| `seoCanonical`   | Textstring        | → `body.meta.seo.canonical` |
| `seoOgImage`     | Textstring        | → `body.meta.seo.ogImage` |
| `seoNoIndex`     | True/false        | → `body.meta.seo.noIndex` |
| `seoNoFollow`    | True/false        | → `body.meta.seo.noFollow` |
| `socialTitle`    | Textstring        | → `body.meta.social.title` |
| `socialDescription` | Textarea      | → `body.meta.social.description` |

**Composition `seoMeta`:** You may implement SEO fields as a composition on `marketingPage` instead of flat properties; the Delivery JSON must still expose the **same property aliases** on the page (flattened), or extend the Next mapper.

## Element types (block list items)

Alias → Next block `type`:

| Element alias   | Next `type` |
|-----------------|-------------|
| `lpHero`        | `hero`      |
| `lpRichText`    | `richText`  |
| `lpImage`       | `image`     |
| `lpCards`       | `cards`     |
| `lpCta`         | `cta`       |

### Field aliases per element (match LP `data` keys)

- **lpHero:** `title`, `subtitle`, `imageId`, `imageAlt`, `ctaLabel`, `ctaHref`
- **lpRichText:** `heading`, `body`
- **lpImage:** `imageId`, `alt`, `caption`
- **lpCards:** `title`, `text`, `items` (array of `{ kicker?, title, text }` or JSON string for `items`), optional `presentation` (defaults to `feature` in mapper)
- **lpCta:** `title`, `body`, `buttonLabel`, `buttonHref`, `secondaryButtonLabel`, `secondaryButtonHref`, `eyebrow`

## Delivery API

`Umbraco/appsettings.json` enables **Content Delivery API** (`Umbraco:CMS:DeliveryApi`) for local headless reads.  
Next.js reads `GET {UMBRACO_DELIVERY_BASE_URL}/umbraco/delivery/api/v2/content/item/{slug}` with optional headers `Api-Key`, `Start-Item`, `Preview`.

## uSync export

After creating document/element/data types in the backoffice: **Settings → uSync → Export** (or Export on Save), commit the generated files under `uSync/` next to this project.
