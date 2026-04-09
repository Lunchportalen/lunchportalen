# Navigation, SEO, and settings model

## 1. Ownership overview

| Concern | Owner (target) | Notes |
|---------|----------------|-------|
| Public site **URL structure** | **Umbraco** tree + slug properties | Next consumes Delivery; no parallel slug editing in Postgres. |
| **Primary navigation** (marketing header/footer) | **Derived from tree** + optional `navigationRoot` | Avoid duplicating every page manually unless IA demands. |
| **SEO title/description/canonical/robots/OG** | **`webPage` variant properties** (from `body.meta.seo` / `social`) | Same semantics as `buildCmsPageMetadata`. |
| **Site-wide SEO defaults** | **`siteSettings`** Document | Fallbacks when page fields empty. |
| **Redirects** | **Umbraco** redirect feature **or** edge/infra | Editorial redirects only if volume justifies. |
| **Operational week menu / orders** | **Application** | **Never** feed public nav from these tables. |

## 2. Menu structure (public website CMS)

**Editorial menu** (what visitors see on marketing site):

1. **Default:** sort children under `webPageHome` (or `contentFolder` → home) by `tree_sort_order` / Umbraco sort index.
2. **Optional:** `navigationItem` nodes with **short title** override and **hidden from nav** flag on `webPage`.

**Not in scope:** “Menu” as product data (dishes, days) — see §1.

## 3. Settings nodes

| Node | Content |
|------|---------|
| **`siteSettings`** | Organization legal name, default OG image, default robots, contact email for footer, social profile URLs, JSON-LD baseline (if used). |
| **`redirectsFolder`** | Child rules or package-managed list. |

## 4. SEO defaults

**Resolution order** (mirror current Next behavior conceptually):

1. Page variant **SEO property** (`seoTitle`, `seoDescription`, …).
2. Page **display title** (`pageTitle`).
3. **`siteSettings`** defaults.
4. Platform **fallback** strings (Next static defaults — outside Umbraco).

## 5. Canonical rules

- Default canonical path = **`/{slug}`** with `home` → `/`.
- Override when **property** `canonical` is set (full URL or path); normalize in Next as today (`canonicalForPath` / `absoluteUrl` logic in Phase 4).

## 6. Robots / noindex

- `noIndex` / `noFollow` → Umbraco **boolean** properties on variant → Next `robots` meta.

## 7. Slug rules

- **Unique per culture** under parent (or globally per site policy).
- **Reserved slugs:** `home`, API paths, app routes — enforce with **Workflow** validator or Document Type event.
- **Editors may change** slug only when Workflow allows (often post-approval restricted).

## 8. Redirect ownership

| Trigger | Owner |
|---------|--------|
| Marketing URL rename | **Editorial** proposes → **Approver** publishes → redirect rule |
| Product route rename (app) | **Engineering** + infra — **not** Umbraco editor |

## 9. What editors may / may not change

| May | May not |
|-----|---------|
| Page copy, blocks, media picks, SEO fields within policy | Production hostname bindings, SSL, CDN keys |
| Nav order (via tree / nav doc) | Operational menu or order windows |
| Submit for review / approve (per group) | Impersonate other tenants (N/A single site) |

## 10. Sanity / legacy blur correction

Any doc implying **Sanity `menuContent`** drives **public website nav** is **incorrect** under this program: it is **operational** data, outside Umbraco website CMS scope.
