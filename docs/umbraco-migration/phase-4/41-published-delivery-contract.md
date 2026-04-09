# Published delivery contract — Umbraco → Next

## 1. Source of truth

| Layer | Source of truth |
|-------|-----------------|
| **Published public website CMS content** | **Umbraco Delivery API** (Content Delivery) for all migrated document types |
| **Not** | Legacy Postgres `content_pages` / `content_page_variants` after cutover for those types |
| **Operational data** | Application APIs / DB — **never** substituted by Delivery for menu, orders, week plans, tenants, billing |

**Explicit enablement:** Delivery API is **not** ambient. It must be **enabled** on the Umbraco Cloud project for each environment where Next reads content, with **API access** configured per Umbraco Cloud / product documentation for the deployed major version.

## 2. What “published content” means

| State | Meaning for this contract |
|-------|---------------------------|
| **Published** | Content visible to anonymous Delivery consumers under **published** culture variants, consistent with Umbraco Workflow **live** transitions (per Phase 2–3 RBAC/workflow design) |
| **Draft / scheduled** | **Excluded** from published Delivery contract — may appear only under **preview** contract (`43-preview-contract.md`) |
| **Culture variant** | A language/culture segment (e.g. `nb`); **only cultures explicitly present and published** are in scope for public render |

## 3. Endpoints and shapes Next depends on

*Concrete paths and query parameter names are **version-specific**; this contract states **obligations**, not a tutorial.*

| Obligation | Detail |
|------------|--------|
| **Content by route / URL segment** | Next must be able to resolve a **public URL path** (e.g. `/some-slug` or localized prefix if signed) to **one** Delivery content item of an allowed document type (e.g. `webPage`) |
| **Content by id/key** | Next or server jobs must be able to resolve **stable identifiers** (GUID/key) for revalidation tags and selective invalidation |
| **Property expansion** | Delivery responses must include **all properties required** to render the page: title, block payload (nested elements), SEO fields, and references resolvable to **Media Delivery** URLs per `44-media-delivery-contract.md` |
| **Hierarchy hints** | Where navigation is **tree-derived** (Phase 2–3), Delivery must expose enough **parent/child** or **explicit nav model** data for Next to build menus without a second authority |

**Assumption confidence:**

| Assumption | Confidence |
|------------|------------|
| Route-based resolution exists for document types modeled as pages | **High** (standard Delivery patterns) — exact API surface **must be confirmed** against target Umbraco version on staging |
| Block List / nested element serialization matches Phase 2–3 element types | **Medium** until a **sample payload** from staging is archived and signed |
| `en` public locale | **Low** until Phase 2–3 blocker **B2** is resolved (currently public Next uses `nb` only) |

## 4. Path / slug lookup expectations

| Rule | Contract |
|------|----------|
| **Canonical public slug** | Owned by Umbraco content (variant-aware per `26-navigation-seo-and-settings-model.md`) |
| **Home** | Special-case root: public `/` maps to home document type (`webPageHome` or equivalent) per content model |
| **Uniqueness** | Slugs unique per policy (per culture under parent or global — **must match** Workflow validators) |
| **Reserved paths** | App routes (`/admin`, `/orders`, `/api`, …) **must not** collide with CMS slugs; enforcement is **Umbraco + Next routing allowlist** |

## 5. Property expansion assumptions

| Topic | Contract |
|-------|----------|
| **Blocks** | Element types from Phase 2–3 are serialized as **structured JSON** (not opaque strings) unless a field is explicitly modeled as raw markup with sanitization ownership documented |
| **Media pickers** | Return **references** (UDI/key/id) resolvable via Media Delivery API — not hard-coded production URLs in content |
| **SEO / social** | Exposed as typed properties or nested object consistent with `buildCmsPageMetadata` semantics (title, description, canonical, robots, OG) |
| **Settings fallbacks** | `siteSettings` (or equivalent) readable via Delivery for defaults |

## 6. Disallowed exposure

| Disallowed | Why |
|------------|-----|
| **Internal/editor-only** properties | Must be marked `IsElement` / delivery settings so they **never** appear in public Delivery |
| **Workflow comments, audit internals** | Not public |
| **Management identifiers** usable for write APIs | No leakage that simplifies abuse of Management surface |
| **Cross-environment** hints | Staging-only flags must not appear on live Delivery |

## 7. What is and is not returned to public consumers

| Returned (published) | Not returned (published channel) |
|------------------------|----------------------------------|
| Renderable page body, SEO, nav-relevant fields | Draft-only fields |
| Media **references** + public media URLs from Media layer | Private blobs without Media Delivery auth (unless `47` future scope explicitly adds member auth) |
| Published culture variants | Unpublished cultures |

## 8. Contract breaks

Any of the following **breaks** the published delivery contract:

| Break | Impact |
|-------|--------|
| Delivery API **disabled** or **wrong environment** wired to Next live | Wrong or empty content |
| **DeliveryApiContentIndex** stale after deploy/model change | 404, missing routes, or empty properties while backoffice shows published |
| **Dual authority** for same slug (Postgres + Umbraco both “live”) after cutover | Inconsistent public truth — **forbidden** as end state |
| **Culture mismatch** (e.g. public `en` URLs without `en` published variants) | 404 or silent fallback — **fail-closed** required in Next mapping contract |
| **Exposing write secrets** on read path or in client | Security failure — invalid |

## 9. Temporary fallback (migration only)

During migration, **time-bounded** dual-read (feature flag, route class, or type-level) may exist **only** as a **migration dependency**, documented in cutover runbooks **outside** Phase 4. Phase 4 **does not** authorize permanent dual-read.

## 10. Related artifacts

- Matrix: [delivery-contract-matrix.csv](./delivery-contract-matrix.csv)
