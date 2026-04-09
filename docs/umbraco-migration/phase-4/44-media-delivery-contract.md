# Media delivery contract — CMS media only

## 1. Scope boundary

| In scope | Out of scope |
|----------|--------------|
| **Images, files, SVG** referenced by **Umbraco** public website CMS content | Operational uploads (invoices, kitchen attachments, user files) |
| **Media Types** per Phase 2–3 (`Image`, `File`, optional `Vector`) | Sanity asset pipeline (legacy) |
| URLs served via **Umbraco Media Delivery API** | Arbitrary external hotlinks unless explicitly modeled as URL picker with CSP ownership |

## 2. Source of truth

| Concern | Source |
|---------|--------|
| **Binary asset** | Umbraco **Media** library |
| **Public URL for render** | **Media Delivery API** (separate enablement from Content Delivery API) |
| **Contextual alt text** | **Block-level** properties per Phase 2–3 (`24-media-localization-and-dictionary-model.md`) — **primary** for accessibility meaning |
| **Media-level metadata** | Optional supplement; **precedence** must be signed if both exist (open question L2/L3 in Phase 2–3) |

## 3. Media Delivery API role

| Obligation | Detail |
|------------|--------|
| **Separate contract** | Enabling Content Delivery API **does not** imply Media Delivery is configured — **both** must be verified per environment |
| **Stable URL pattern** | Next mapping uses **documented** URL shape for the Cloud Umbraco version (path + query transforms) |
| **Auth** | If Media Delivery requires **API key** or signed URLs, **server-side only** |

## 4. Image / file / SVG rules

| Type | Rule |
|------|------|
| **Raster images** | Use **Media Delivery** transforms (width, format, quality) where supported — **no** duplicate custom image worker unless Security approves |
| **SVG** | Allowed **only** if Phase 2–3 **L2** signed; if allowed, **sanitize** policy owner = Security + Engineering |
| **PDF / downloads** | Direct Media Delivery URL; **no** inline execution |
| **Focal point / crops** | **Assume** focal point from Umbraco Image; crop alias **named** in content model (hero, card, og) |

## 5. Alt text / caption

| Field | Contract |
|-------|----------|
| **Alt** | Required for meaningful images at **block** level when L3 resolved; empty alt only for decorative **with** explicit flag |
| **Caption** | Block property; optional |
| **Locale** | Variant per culture where content is translated |

## 6. URL ownership

| Owner | Owns |
|-------|------|
| **Umbraco** | Media item identity, processing, CDN backing (Cloud) |
| **Next** | Composing **final** `src` with **allowed** transform params; **must not** persist transformed URLs back to Umbraco |

## 7. Caching assumptions

| Layer | Guidance |
|-------|----------|
| **CDN (Cloud)** | Long-cache **immutable** URLs where query includes content version or cache buster |
| **Next** | Published pages may cache **mapped** page payloads; **preview** must not cache media responses that include draft-only picks |
| **Browser** | Standard `Cache-Control` from Media Delivery |

## 8. What Next may transform

| Allowed | Forbidden |
|---------|-----------|
| Width/height/format/quality query params per API | Stripping security-related params |
| `next/image` optimization **if** compatible with Media Delivery hostname allowlist | Rewriting to different host without governance |
| Placeholder on slow load | Replacing asset with **stock** imagery not in content |

## 9. Authored metadata (must remain)

| Metadata | Rule |
|----------|------|
| **Focal point** | Authored in Umbraco — Next **reads**, does not invent |
| **Copyright / credit** | If modeled, pass through to render |
| **Media item name** | Not a substitute for alt |

## 10. Media failure handling

| Case | Behavior |
|------|----------|
| **404** from Media Delivery | Render broken-image placeholder + **monitor**; **do not** crash page |
| **Missing reference** after delete | Block-level fail closed (omit image) |
| **Timeout** | Same as 404 for UX; **retry** policy server-side only |

## 11. Related artifacts

- [media-contract-matrix.csv](./media-contract-matrix.csv)
