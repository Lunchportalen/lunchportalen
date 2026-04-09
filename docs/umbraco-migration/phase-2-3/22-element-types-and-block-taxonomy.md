# Element Types and block taxonomy

## Strategy

- **Block editor:** Umbraco **Block Grid** or **Block List** on `webPage` / `webPageHome` (implementation-phase choice). **Default: Block Grid** for layout bands if design requires; else **Block List** for simplicity.
- **One Element Type per persisted block family** aligned with `CORE_RENDER_BLOCK_TYPES` in `lib/cms/blocks/registry.ts`, unless **merged** below.
- **Plugins:** any additional persisted `type` from `getBackofficeBlockCatalog()` requires the same treatment — inventory before ETL.

## Block lifecycle legend

| Tag | Meaning |
|-----|---------|
| **KEEP** | 1:1 Element Type |
| **MERGE** | Combine with another Element Type |
| **SPLIT** | Multiple Element Types from one legacy block |
| **KILL** | Remove from editor / do not migrate |

## Matrix: block families → Element Types

| Block family | Legacy / source `type` | Proposed Element Type (alias) | Fields (properties) | Editor constraints | Nesting | Reusability | Stock block editor enough? | Custom block view? | Confidence |
|--------------|------------------------|-------------------------------|---------------------|--------------------|---------|-------------|-----------------------------|-------------------|------------|
| Hero (compact) | `hero` | **`elHeroCompact`** | Title (text), Subtitle (text), Image (media), Alt (text), CTA label (text), CTA link (multi URL), optional design toggles | Max lengths match today (~120 title) | **None** | Same type across pages | **Yes** | **No** default | High |
| Hero full width | `hero_full` | **`elHeroFull`** OR **MERGE** → `elHero` + `layoutMode=full` | + `useGradient` (true/false) | Same | **None** | — | **Yes** | **No** default | High |
| Hero bleed | `hero_bleed` | **`elHeroBleed`** OR **MERGE** → `elHero` + layout | Title, Subtitle (textarea), Primary/secondary CTA text+link, Background image (mandatory), Overlay image (opt), Overlay alt, `variant`/`textAlign`/position enums | Internal vs external link: use **Multi URL Picker** + convention | **None** | — | **Yes** | Optional **custom block view** if editors need visual layout pickers | High |
| Rich text section | `richText` | **`elRichTextSection`** | Heading (text), Body (rich text **or** textarea to match current plain storage) | Prefer **RTE** if content has inline formatting going forward | **None** | — | **Yes** | No | High |
| Image | `image` | **`elImage`** | Image (media, mandatory), Alt (mandatory), Caption | WCAG: alt required | **None** | — | **Yes** | No | High |
| CTA band | `cta` | **`elCtaBand`** | Title, Body, Button label, Button link | — | **None** | — | **Yes** | No | High |
| Divider | `divider` | **`elDivider`** | Style: line / space | Dropdown | **None** | — | **Yes** | No | High |
| Cards | `cards` | **`elCards`** | Title, Intro text, **Block List** of `elCardItem`; optional **CTA rows** (nested element or repeatable) | Min/max card count policy | **One level** items | Item as **`elCardItem`** Element Type | **Yes** | Optional view for column preview | High |
| Card item | *(inline in `cards.items`)* | **`elCardItem`** | Title, Text | Child of `elCards` only | — | **No** standalone | **Yes** | No | High |
| Zigzag / steps | `zigzag` | **`elZigzag`** | Section title, **Block List** of `elZigzagStep` | Min 2 steps typical | One level | — | **Yes** | Optional | High |
| Zigzag step | *(inline)* | **`elZigzagStep`** | Step label, Title, Text, Image | — | — | — | **Yes** | No | High |
| Pricing | `pricing` | **`elPricing`** | Title, Intro; **Block List** of `elPricingPlan`; empty plans = runtime “live pricing” in Next | Document in Delivery mapping: empty list triggers API | One level | — | **Yes** | **Custom view** only if editors need live preview of API-fed state | Medium |
| Pricing plan row | *(inline)* | **`elPricingPlan`** | Name, Price, Featured (bool), Features (repeatable text) | — | — | — | **Yes** | No | High |
| Grid | `grid` | **`elImageGrid`** | Title, Variant (left/center/right), **Block List** `elGridItem` | — | One level | — | **Yes** | No | High |
| Grid item | *(inline)* | **`elGridItem`** | Title, Image | — | — | — | **Yes** | No | High |
| Banner | `banner` | **`elBanner`** | Text, Background image, CTA label+link, variant | Same link pattern as hero_bleed | **None** | — | **Yes** | No | High |
| Form embed | `form` | **`elFormEmbed`** | Form ID (string), Title | Validate against known form registry in app **outside** Umbraco | **None** | — | **Yes** | Optional picker UI **if** form list is dynamic | Medium |
| Related links | `relatedLinks` | **`elRelatedLinks`** | Current path (text), Tags (tags picker), Title, Subtitle | Tags: use **Tags** property or comma list → **prefer Tags** | **None** | — | **Yes** | No | Medium |

## Merge / split / kill decisions

| Decision | Detail |
|----------|--------|
| **MERGE (optional)** | `hero`, `hero_full`, `hero_bleed` → single **`elHero`** with `layoutVariant` enum (**compact** / **full** / **bleed**). **Pros:** fewer types. **Cons:** complex editor form; **recommendation:** **KEEP separate** Element Types for Phase 2 clarity; merge in Phase 4+ only with UX proof. |
| **SPLIT** | `cards.items[]` → **`elCardItem`**; `zigzag.steps[]` → **`elZigzagStep`**; `pricing.plans[]` → **`elPricingPlan`**; `grid.items[]` → **`elGridItem`**. |
| **KILL** | No core block types killed without replacement. **Plugin-only** blocks (e.g. `article_list` in design registry): migrate only if still used in persisted content — else **KILL** after content audit. |

## Block anti-patterns (reject)

- Storing block payload as JSON in a single property.
- Nesting **Block Grid** arbitrarily deep without limit (set max levels).
- Using **Related links** for operational navigation.
- **Pricing** plan rows duplicated from **product** DB in CMS when “live pricing” is intended — prefer empty plans + app resolver.

## Stock vs custom summary

| Area | Verdict |
|------|---------|
| Block List / Grid hosting Element Types | **Stock** |
| Per-block custom Angular/React property editors | **Reject** by default |
| Custom block **presentation** (live preview thumbnail) | **Optional** for `hero_bleed`, `pricing` only |

---

*See also:* [block-taxonomy.csv](./block-taxonomy.csv)
