# Phase 2A — Execution log

**Scope (V3):** CMS visual DNA (GetInspired/Stormberg-inspirert, ikke kopi), glass/neon-disiplin, CMS Design targeting (global + blokk), ContentWorkspace preview-modul, komponentrot-migrering, dokumentasjon.

**Scope (V4):** CMS Design **persistens** for page + **section** scope, én **merge-kjede** (global → page → section → block), samme logikk i preview og publisert render, token/preset-basert.

**Date:** 2026-03-28

## Steps completed (V4)

1. **Merge engine** — `buildEffectiveParsedDesignSettingsLayered` + `CMS_META_PAGE_DESIGN_KEY` / `CMS_META_SECTION_DESIGN_KEY` i `lib/cms/design/designContract.ts`; `getGlobalSettingsDataRoot` i `getDesignSettings.ts`.
2. **Body meta** — `parseBodyMeta` i `lib/cms/public/parseBody.ts`; `loadLivePageContent` returnerer `meta`; `renderPipeline` re-eksporterer `parseBodyMeta`.
3. **Publisert render** — `CmsBlockRenderer` med `pageCmsMeta`; `[slug]`, `page.tsx`, `preview/[id]` koblet.
4. **Live preview** — `PublicPageRenderer` / `LivePreviewPanel` / `PreviewCanvas` / `ContentWorkspacePreviewPane` med `pageCmsMeta` + `pageCmsMetaForPreview` (inkl. historikk-body meta) i `ContentWorkspace.tsx` + chrome `main`-tuple.
5. **UI** — `CmsPageSectionDesignPanels.tsx` (side + seksjon), `CmsBlockDesignSection` med `sectionId`, `CmsDesignTargetingBar` oppdatert, `ContentWorkspacePropertiesRail` wiring.
6. **Tester** — `tests/cms/designMergeLayers.test.ts`.
7. **Dokumentasjon** — `PAGE_SCOPE_DESIGN_IMPLEMENTATION.md`, `SECTION_SCOPE_DESIGN_IMPLEMENTATION.md`, `DESIGN_MERGE_RULES.md`, `CMS_DESIGN_UI_SCOPE_FLOW.md`, `CMS_DESIGN_PREVIEW_PUBLISH_ROLLBACK.md`.

## Verification (V4)

- `npm run typecheck` — **PASS**
- `npm run build:enterprise` — **PASS** (full RC-pipeline inkl. Next build + SEO-skript)

## Steps completed (V3)

1. **Tokens / DNA**
   - `app/globals.css`: `--lp-chrome-bg`, `--lp-ink-plum`, `--lp-accent-neon-rgb` alias; mørk modus justerer chrome-plum.
   - `docs/phase2a/LUNCHPORTALEN_VISUAL_DNA.md`, `BACKOFFICE_SURFACE_HIERARCHY.md`, `PHASE2A_VISUAL_REFERENCE_NOTES.md`.

2. **Shell / backoffice**
   - `TopBar`: `bg-[rgb(var(--lp-chrome-bg))]/90` (tidligere hardkodet slate).
   - `ContentWorkspaceRightRail`: AI-intro glass + rosa kant (UI only).

3. **CMS Design targeting**
   - `CmsDesignTargetingBar.tsx` — viser side, slug, valgt blokk; knapp «Globalt design» → global workspace + Innhold og innstillinger → Generelt.
   - `CmsBlockDesignSection.tsx` — blokk-`config` (tema, layout, kort-variant, hover) via `designContract`.
   - `GlobalDesignSystemSection.tsx` — tydelig «omfang: globalt»-tekst.
   - Wiring: `ContentWorkspace.tsx` (`onNavigateToGlobalDesignSettings`), `contentWorkspaceChromeShellInput.ts` / `contentWorkspaceChromeProps.ts`, `ContentWorkspaceMainCanvas.tsx`.

4. **ContentWorkspace split**
   - `ContentWorkspacePreviewPane.tsx` — preview-gren.
   - `ContentWorkspaceMainCanvas.tsx` — bruker preview-pane + targeting-bar.

5. **Component root**
   - `src/components/layout/PageContainer.tsx`; `components/layout/PageContainer.tsx` re-eksporterer.

6. **CMS Design docs**
   - `CMS_DESIGN_TARGETING_PLAN.md`, `CMS_DESIGN_SCOPE_MODEL.md`, `CMS_DESIGN_PREVIEW_AND_PUBLISH_RULES.md`.

## Verification

- `npm run typecheck` — PASS (etter siste fiks av `chromeShellMain`-signatur).
- `npm run build:enterprise` — **PASS** (full RC pipeline).

## Out of scope (per brief)

- Page-level persisted `designSettings` (krever page-envelope API — dokumentert som gjenstående).
- Auth, onboarding, week, order/window, billing, middleware, post-login.
