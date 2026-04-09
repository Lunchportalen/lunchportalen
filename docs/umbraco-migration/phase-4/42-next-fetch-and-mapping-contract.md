# Next.js fetch and mapping contract — published CMS data

## 1. Purpose

This document defines **runtime boundaries** for how the Next.js app **may** consume **published** Umbraco Delivery API responses and map them to render models. **No implementation code** — obligations and prohibitions only.

## 2. Fetch responsibility boundaries

| Concern | Owner |
|---------|--------|
| **HTTP(S) to Umbraco Delivery API** | **Next server** only (Server Components, Route Handlers, Server Actions) — **never** browser-direct to Delivery with secrets |
| **Environment base URLs** | Host env (`*_UMBRACO_DELIVERY_BASE_URL` or Cloud-provided pattern) — **per environment**, no cross-env leakage |
| **Authentication to Delivery** | Server-side headers or Cloud-required mechanism using **Delivery API key** or **version-appropriate** public/read token model — **secret never in client bundle** |
| **Operational APIs** (pricing, menu, orders) | Existing application APIs — **orthogonal** fetch; may **compose** with CMS mapping at render time |

## 3. Mapping layer responsibilities

| Must | Must not |
|------|----------|
| Map Delivery JSON → **internal render DTO** (blocks, meta, title, slug) stable for `CmsBlockRenderer` or successor | Silently invent fields not present in Delivery |
| Normalize slug, canonical, and culture per signed IA | Treat missing culture as “default English” without signed rule |
| **Fail closed** on schema mismatch for **required** blocks | Render arbitrary unchecked HTML from untrusted shapes without documented sanitization owner |
| Preserve **accessibility contracts** from Phase 2–3 (alt text precedence) | Drop alt/caption because Delivery nested shape differs — **map or block publish** |

## 4. Fallback policy

| Scenario | Policy |
|----------|--------|
| **Published variant missing** | **Do not** fall back to another culture for public SEO URLs unless **explicitly signed** (B2 resolution) |
| **Optional block property missing** | Use content model defaults defined in Phase 2–3 or omit feature — **no business guess** |
| **Unknown block type in payload** | **Fail closed** for that subtree: omit block + structured log / monitor — **or** hard error per product choice (must be consistent per route class) |
| **Legacy Postgres read** | **Temporary** only under migration flag; **not** an end-state fallback |

## 5. Error behavior

| Condition | Behavior |
|-----------|----------|
| Delivery **5xx** / timeout | Do not cache error as success; show **safe error UI** or static fallback **only if** product-approved |
| Delivery **404** | Treat as **not found** for that slug/culture |
| **Parse** failure | **Fail closed** — do not partially render corrupted body |

## 6. 404 behavior

| Case | Behavior |
|------|----------|
| Unknown slug | `notFound()` (or equivalent) for public marketing routes |
| Known slug, **unpublished** | 404 on **published** path (draft only via preview) |

## 7. Missing content

| Case | Behavior |
|------|----------|
| Empty block list | Render empty state (matches current UX pattern) |
| Missing `siteSettings` | Use Next static defaults only where Phase 2–3 allows |

## 8. Unsupported block / property output

| Rule | Detail |
|------|--------|
| **Version skew** (Umbraco deployed ahead of Next) | Mapping must **tolerate** unknown keys; **must not** crash entire page unless critical |
| **Critical blocks** (e.g. hero) invalid | **Fail closed** or show replacement message — **decision owned by product** and documented once |
| **Custom property editor** value | If Delivery shape is not stable, **blocker** for that block’s go-live until **sample payload signed** |

## 9. Where transformation is allowed

| Allowed | Example |
|---------|---------|
| **Presentation** normalization | Crop alias selection, image width params for Media Delivery URLs |
| **SEO** URL absolutization | Canonical/OG URL building from host + path |
| **Rich text** | Server-side transform **only** with owned sanitizer / allowed tags list |
| **Experimental / A/B** hooks | Read from app plane; CMS provides **content** only |

## 10. Where transformation is forbidden

| Forbidden | Why |
|-----------|-----|
| **Inventing** copy or prices | Violates single source of truth |
| **Merging** operational DB content into CMS body | Breaks authority boundary |
| **Caching published mapping as preview** | Preview contract violation |

## 11. Contract drift anti-patterns

| Anti-pattern | Reject |
|--------------|--------|
| “**Loose**” `any` mapping + silent omission | Hides ETL/model errors until production |
| Client-side `fetch` to Delivery with API key | Secret exposure |
| **ISR tag** shared between preview and published without separation | Draft leakage risk |
| **Permanent** feature flag dual-read | Violates end-state single path |

## 12. Current code pointer (legacy, not target)

Today: `lib/cms/public/loadLivePageContent.ts` reads Postgres. Phase 5+ implementation **replaces** this path for migrated types per cutover plan — **not** described here.
