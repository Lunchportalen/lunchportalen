# Media, localization, and Dictionary Items

## 1. Media Type strategy

| Media Type | Use | Stock / custom |
|------------|-----|----------------|
| **Image** | Photos, illustrations for blocks | **Stock** — enable **focal point** (Umbraco default on Image) |
| **File** | PDF, downloadable assets | **Stock** |
| **Vector / SVG** | Logos, icons (only if security policy allows SVG upload) | **Stock** Media Type with extension allowlist |
| **Folder** | Editorial organization | **Stock** (virtual folders in Media tree) |

**Umbraco Cloud:** use platform defaults for processing where applicable; **no custom image pipeline** in Phase 2–3 design.

## 2. Alt text and caption

| Rule | Owner |
|------|--------|
| **Alt text** for meaningful images | **Element Type property** on `elImage`, `elHero*`, `elZigzagStep`, etc. — **variant** per culture |
| Decorative images | Empty alt + editor training; block-level “decorative” flag **only if** legally/accessibility needed |
| **Caption** | Block property (`elImage`), variant |

**Do not** rely on Media item **only** for alt: Umbraco Media has properties, but **contextual** alt often belongs on the **block** (same image, different meaning).

## 3. Naming and folder conventions

| Folder (example) | Contents |
|------------------|----------|
| `/site/marketing/` | Campaign and page imagery |
| `/site/icons/` | Small brand assets |
| `/site/og/` | Default OG images |
| `/legacy-import/` | Staging area for migrated assets (delete after cutover) |

**Naming:** original filename preserved; **no** business meaning in filename alone (use node name + taxonomy).

## 4. Focal point and cropping

- **Assume** Umbraco **Image Cropper** / focal point **available** for hero imagery.
- **Delivery:** Next consumes cropped URLs from Media Delivery API when Phase 4 defines image URL shape.
- **Blocks** store **media reference** (UDI/key), not raw URL strings, in target state.

## 5. Language variants strategy (site editorial)

| Content | Variant by culture? |
|---------|----------------------|
| `webPage` human fields (title, blocks, SEO) | **Yes** — `nb` mandatory; additional cultures when signed |
| `siteSettings` translatable defaults | **Yes** for text defaults |
| Media **binary** | **Invariant** (one file); **metadata** on Media can be variant if team enables |
| Dictionary Items | **Per culture** (built-in) |

## 6. Dictionary Items vs content

| Use **Dictionary Items** | Use **content properties** |
|--------------------------|-----------------------------|
| Repeated **UI chrome** labels shared across templates (e.g. “Les mer”, “Kontakt oss” if identical everywhere) | Anything **SEO-critical**, **page-specific**, or **block-specific** |
| Legal microcopy that must be identical on all pages | Hero titles, CTAs that carry conversion meaning |
| System buttons in partial views | Rich marketing copy |

**Rule:** If changing the string **only on one page** should be possible, it is **not** a Dictionary Item.

## 7. `nb` and future locales

- **Primary culture:** `nb` (Norwegian Bokmål) — **required** for all in-scope editorial types.
- **Secondary:** codebase references `en` in workflow API (`LOCALES`); public routes currently hardcode **`nb`** for render. **Before Phase 4:** sign whether `en` is a **real** public locale or **future-only** — affects Umbraco culture list, URL strategy, and Translation Workflow.

## 8. Blocked questions (require explicit sign-off)

| ID | Question |
|----|----------|
| L1 | Is **`en`** (or other) a **published** public culture on go-live, or **nb-only** until a dated expansion? |
| L2 | Are **SVG uploads** allowed for editors, or **admin-only** / forbidden? |
| L3 | **Media alt** mandatory at **block** level, **Media** level, or **both** (with precedence rule)? |

Until L1 is signed, **Phase 2 exit** remains **at risk** for URL + variant design.
