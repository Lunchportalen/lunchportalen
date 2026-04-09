# CMS Design UI — scope flow (Phase 2A)

## Levels

| Level | Where in UI | Storage |
|-------|-------------|---------|
| Global | Innhold og innstillinger → Generelt → `GlobalDesignSystemSection` | `global_content.settings.data.designSettings` |
| Page | Egenskaper → Innhold → **CMS-design (side)** | `meta.pageDesign` |
| Section | Egenskaper → Innhold → **CMS-design (seksjon)** | `meta.sectionDesign[id]` |
| Block | Egenskaper → Innhold → **CMS-design (blokk)** (when a block is selected) | `block.config` |

## Targeting bar

- `CmsDesignTargetingBar` shows **page title**, **slug**, and **selected block** (if any), and explains **side → seksjon → blokk** with a shortcut to global tokens.

## Preview

- `pageCmsMetaForPreview` in chrome wiring: current draft `meta`, or **historical** `meta` when previewing a version (`parseBodyToBlocks(historyVersionPreview.body).meta`), so preview matches the snapshot being inspected.

## Rules

- No free CSS; only enums/tokens from `designContract` and `mergeDesignSettingsIntoGlobalContentData` patches.
