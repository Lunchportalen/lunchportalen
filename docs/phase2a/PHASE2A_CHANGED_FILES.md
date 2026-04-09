# Phase 2A — Changed files (V3 + V4)

## V4 — New files

| Path | Purpose |
|------|---------|
| `app/(backoffice)/backoffice/content/_components/CmsPageSectionDesignPanels.tsx` | CMS-design (side) + (seksjon) paneler |
| `tests/cms/designMergeLayers.test.ts` | Merge global/page/section + block |
| `docs/phase2a/PAGE_SCOPE_DESIGN_IMPLEMENTATION.md` | Page-scope lagring |
| `docs/phase2a/SECTION_SCOPE_DESIGN_IMPLEMENTATION.md` | Section-scope |
| `docs/phase2a/DESIGN_MERGE_RULES.md` | Merge-regler |
| `docs/phase2a/CMS_DESIGN_UI_SCOPE_FLOW.md` | UI flyt |
| `docs/phase2a/CMS_DESIGN_PREVIEW_PUBLISH_ROLLBACK.md` | Preview/publish/rollback |

## V3 — New files

| Path | Purpose |
|------|---------|
| `app/(backoffice)/backoffice/content/_components/CmsDesignTargetingBar.tsx` | Side/blokk omfang + navigasjon til globalt design |
| `app/(backoffice)/backoffice/content/_components/CmsBlockDesignSection.tsx` | Blokk `config` (tokens/presets) |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspacePreviewPane.tsx` | Preview canvas-gren |
| `src/components/layout/PageContainer.tsx` | Canonical PageContainer |
| `docs/phase2a/LUNCHPORTALEN_VISUAL_DNA.md` | Visual DNA |
| `docs/phase2a/BACKOFFICE_SURFACE_HIERARCHY.md` | Surface hierarchy |
| `docs/phase2a/CMS_DESIGN_TARGETING_PLAN.md` | Targeting plan |
| `docs/phase2a/CMS_DESIGN_SCOPE_MODEL.md` | Scope model |
| `docs/phase2a/CMS_DESIGN_PREVIEW_AND_PUBLISH_RULES.md` | Preview/publish rules |
| `docs/phase2a/PHASE2A_VISUAL_REFERENCE_NOTES.md` | GetInspired / Stormberg / LP notes |

## V4 — Modified files (hovedtrekk)

| Path | Change |
|------|--------|
| `lib/cms/design/designContract.ts` | `sectionId` på `BlockConfig`, `buildEffectiveParsedDesignSettingsLayered`, meta-nøkler |
| `lib/cms/design/getDesignSettings.ts` | `getGlobalSettingsDataRoot` |
| `lib/cms/public/parseBody.ts` | `parseBodyMeta` |
| `lib/cms/public/renderPipeline.ts` | Eksport `parseBodyMeta` |
| `lib/cms/public/loadLivePageContent.ts` | `meta` på `LivePublicPage` |
| `components/cms/CmsBlockRenderer.tsx` | `pageCmsMeta`, per-blokk effective DS |
| `app/(public)/[slug]/page.tsx`, `app/(public)/page.tsx` | `pageCmsMeta` |
| `app/(backoffice)/backoffice/preview/[id]/page.tsx` | `parseBodyMeta` + `pageCmsMeta` |
| `app/(backoffice)/backoffice/content/_components/PreviewCanvas.tsx` | `pageCmsMeta`, `globalSettingsDataRoot`, per-blokk merge |
| `LivePreviewPanel.tsx`, `ContentWorkspacePreviewPane.tsx`, `ContentWorkspaceMainCanvas.tsx`, `ContentMainShell.tsx` | `pageCmsMeta` wiring |
| `ContentWorkspace.tsx` | `pageCmsMetaForPreview`, chrome `main` |
| `contentWorkspaceChromeProps.ts`, `contentWorkspaceChromeShellInput.ts` | `pageCmsMetaForPreview`, `chromeShellMain`-rekkefølge |
| `CmsBlockDesignSection.tsx`, `CmsDesignTargetingBar.tsx`, `ContentWorkspacePropertiesRail.tsx` | Scope UI |

## V3 — Modified files (hovedtrekk)

| Path | Change |
|------|--------|
| `app/globals.css` | V3 `--lp-chrome-bg`, `--lp-ink-plum`, accent alias |
| `app/(backoffice)/backoffice/_shell/TopBar.tsx` | Chrome token |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceMainCanvas.tsx` | Preview pane, targeting bar, `onNavigateToGlobalDesignSettings` |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | `onNavigateToGlobalDesignSettings` + chrome `main` tuple |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceChromeProps.ts` | Build input + mainCanvas |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceChromeShellInput.ts` | `ChromeShellMainOnly` + `chromeShellMain` |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspacePropertiesRail.tsx` | `CmsBlockDesignSection` |
| `app/(backoffice)/backoffice/content/_components/GlobalDesignSystemSection.tsx` | Omfang-tekst |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceRightRail.tsx` | AI intro glass V3 |
| `components/layout/PageContainer.tsx` | Re-export fra `src` |
| `docs/phase2a/*.md` | Oppdatert der relevant |

## Build / typecheck (V4)

- `npm run typecheck`: **PASS**
- `npm run build:enterprise`: **PASS**
- `npx vitest run tests/cms/designMergeLayers.test.ts`: **PASS**

## Consumer map (navigasjon til global design)

- `CmsDesignTargetingBar` → `onNavigateToGlobalDesignSettings` → `ContentWorkspace` → `goToGlobalWorkspace` + `setGlobalSubView("content-and-settings")` + `setContentSettingsTab("general")`.
