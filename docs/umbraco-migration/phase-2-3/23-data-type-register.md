# Data Type register

Maps **field families** to **Umbraco Data Types**. Use **stock** Property Editors unless noted.

| Field family | Umbraco Data Type (proposed) | Stock / custom | Where used | Validation | Localization | Notes |
|--------------|------------------------------|----------------|------------|------------|--------------|-------|
| Plain title / short text | **Textstring** (max length) | Stock | All block titles, nav labels | 60–200 chars per field | **Variant** | Use separate Data Types per max length if editors need clarity. |
| Long plain text | **Textarea** | Stock | Subtitles, intros | Max 500–5000 | **Variant** | |
| Rich HTML body | **RTE** (Tiptoe / TinyMCE per Cloud default) | Stock | Future-proof `richText.body` | Sanitization policy in Delivery/Next | **Variant** | If migration keeps plain text initially, start Textarea → promote to RTE later. |
| Boolean | **True/false** | Stock | `useGradient`, `featured`, flags | — | Usually **Invariant** | |
| Integer / sort | **Numeric** | Stock | Rare | Min/max | Invariant | |
| Dropdown enum | **Dropdown** / **Radiobox** | Stock | `divider.style`, layout enums | Allowed list | **Invariant** for layout | |
| Media reference (image) | **Media Picker** (Image only) | Stock | Hero, image, grid, zigzag | Required where WCAG demands | Picker is invariant; **alt** on block is variant | |
| File / PDF | **Media Picker** (File) | Stock | Downloads | — | — | |
| SVG | **Media Picker** + dedicated **Media Type** `vector` | Stock | If allowed | MIME restrict | — | |
| External + internal URL | **Multi URL Picker** | Stock | CTAs, buttons | Allow `mailto:`, `tel:` per policy | **Variant** if localized landing | Replaces `ctaPrimaryHrefKind` editor hint — URL picker handles types. |
| Single page reference | **Content Picker** (scoped) | Stock | Optional “related page” | Must restrict to `webPage` | Can be variant | |
| Multi page / picker | **Multi Node Tree Picker** | Stock | Related pages, settings links | — | — | |
| Tags (related links) | **Tags** (group) / or Tags Data Type | Stock | `relatedLinks.tags` | Normalize lowercase | **Variant** | |
| Block composition (page body) | **Block Grid** *or* **Block List** Data Type pointing at allowed Element Types | Stock | `webPage` main | Min/max blocks optional | **Variant** | |
| Nested repeatable items | **Block List** of Element Type (child) | Stock | Cards, zigzag, pricing plans | — | **Variant** | |
| SEO title | **Textstring** (70 soft) | Stock | `meta.seo.title` | — | **Variant** | |
| SEO description | **Textarea** (155 soft) | Stock | `meta.seo.description` | — | **Variant** | |
| Canonical URL | **Textstring** or Multi URL | Stock | `canonical` / `canonicalUrl` | URL format | **Variant** | Merge legacy duplicate fields in migration. |
| Robots flags | **True/false** pair | Stock | `noIndex`, `noFollow` | — | **Variant** | |
| OG image | **Media Picker** or Textstring (URL) | Stock | `ogImage` | Prefer Media for governance | **Variant** | |
| Social title/description | **Textstring** / **Textarea** | Stock | `meta.social` | — | **Variant** | |
| Intent / audience / keywords | **Textstring** + **Repeatable text** (custom config) or nested block | Stock / light custom | `meta.intent` | Optional | **Variant** | Prefer **nested Element Type** `elSeoIntent` if structure is stable. |
| CRO hints | **Textarea** fields | Stock | `meta.cro` | — | **Variant** | |
| Diagnostics | **DROP** from editorial Umbraco | — | `meta.diagnostics` | — | — | Not a public content concern; **do not migrate** as authored content (see disposition register). |
| Form ID | **Textstring** with regex / picklist | Stock | `form.formId` | Allowed IDs | Invariant | Optional custom picker fed by manifest (custom editor) — justify in §33. |
| Slug / segment | **Textstring** (culture) + URL segment rules | Stock | `webPage` | uniqueness per culture | **Variant** | Enforce with Workflow validation step if needed. |
| JSON-LD / structured data blob | **Textarea** (JSON) or dedicated **Code** editor | Stock | Only if `siteSettings` needs it | Schema validate in CI | **Variant** | Last resort — prefer structured properties. |

## Localization rule summary

- **Variant:** all user-visible copy, SEO, URLs that differ per culture.
- **Invariant:** internal keys, layout enums, form IDs if global, media **file** choice (not alt text).

---

*Optional:* split Data Types per Document Type for different pickers (e.g. “Hero image only” vs “Any image”) using **same Property Editor, different configuration** — still **stock**.
