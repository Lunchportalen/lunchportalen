# Media, redirect, and URL migration spec

**CMS-owned editorial assets only.** Operational file stores (kitchen, invoices, etc.) are **out of scope**.

## 1. Media migration rules

| Rule | Detail |
|------|--------|
| **Scope** | Images/files **referenced** from in-scope pages/blocks |
| **Import** | Upload/import to Umbraco Media Library under agreed folder convention (see Phase 2–3 `24`) |
| **Staging folder** | `/legacy-import/` allowed **until** cutover hygiene |
| **References in content** | Target = **Media Picker** / UDI — not legacy `cms:*` string in final state |
| **Deduplication** | Hash + size **or** stable legacy id → one Media item |
| **SVG** | Only if **L2** signed (admin-only / forbidden) per Phase 2–3 |

## 2. Alt and caption preservation

Per [`../phase-2-3/24-media-localization-and-dictionary-model.md`](../phase-2-3/24-media-localization-and-dictionary-model.md):

- **Contextual alt** migrates from **block** properties where they exist today.
- **Media-level** alt migrates when that was source of truth.
- **L3 precedence** (block vs Media vs both): **must be signed** (PB6); until then, ETL **fail closed** on conflict **or** route to **manual_review** per manifest row.

## 3. Focal point and crop

| Aspect | Rule |
|--------|------|
| **If legacy stored focal/crop** | Map to Umbraco Image Cropper / focal **when data exists** |
| **If missing** | Default focal center; **document** as acceptable delta |
| **Delivery** | Render URLs per Phase 4 Media Delivery contract |

## 4. URL ownership

| Concern | Owner after cutover |
|---------|---------------------|
| **Public CMS path** | Umbraco slug + tree + locale policy |
| **App routes** | Next routing allowlist — **reserved paths** must not collide (`41`) |

## 5. Redirect generation rules

| Trigger | Action |
|---------|--------|
| **Slug change** during migration | Create `redirectRule` (or edge redirect list) **per later execution phase** — Phase 5 **defines** required metadata: `from_path`, `to_path`, `culture`, `http_code`, `owner` |
| **Structural path change** | Same |
| **No automatic redirect** | For pages **deleted** without replacement — **manual** policy |

## 6. Redirect authority

- **Editorial redirects** live in Umbraco **if** modeled as `redirectRule` DT; otherwise **infra** (CDN/host) — **one** authority per environment (no conflicting duplicates).
- Phase 5 **does not** deploy redirects; it specifies **complete source list** for Phase 7+.

## 7. Slug collision handling

| Case | Rule |
|------|------|
| **Duplicate under same parent + culture** | **FAIL** ETL; resolve in legacy or Umbraco **before** rerun |
| **Collision with reserved app path** | **FAIL** validation |
| **Cross-culture** | Per signed B2 URL strategy |

## 8. Broken reference handling

| Case | Rule |
|------|------|
| **Missing binary** | Quarantine row; **no** silent drop of block |
| **403/404 URL** | Quarantine; editorial fix in Umbraco post-migrate |
| **External URL** | Keep as **external** link type where modeled; **do not** import as Media |

## 9. What does not migrate

| Item | Reason |
|------|--------|
| **Operational menu images** | Not CMS scope |
| **Private user uploads** | Not public CMS |
| **Ephemeral AI-generated temp assets** | Regenerate under policy if needed |
| **Hard-coded production CDN paths** | Normalized to **logical** reference + Media Delivery |

## 10. Contract alignment

- Phase 4 [`44-media-delivery-contract.md`](../phase-4/44-media-delivery-contract.md) defines **consumer** obligations; Phase 5 ensures **references** are compatible with that contract post-import.
