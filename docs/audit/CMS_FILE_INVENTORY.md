# CMS File Inventory

**Generert:** 2026-03-26  
**Repo:** Lunchportalen (Next.js App Router + Supabase + Sanity Studio)

## Metode og antall

- **Kilde:** `git ls-files` med mønstre for CMS-kjerne + manuell utvidelse med støttefiler (`lib/ai/*pageBuilder*`, `layout/global*Cms`, `components/ui/cms`, `domain/backoffice/ai` der innholdseditoren bruker dem).
- **Rapportert antall analyserte filer:** **228** (unike filstier, ikke `node_modules`, ikke genererte `.next`/`dist`).
- **Merknad:** `studio/**` inkluderer kilde under `studio/` men **ekskluderer** `studio/**/node_modules/**` (ikke listet som analyserte filer).

## Mapper som inngår i CMS-løsningen

| Mappe | Rolle |
|-------|--------|
| `lib/cms/` | Kjerne: blokkontrakter, registry, normalisering, media, design, draft/publish-hjelpere, public parse. |
| `lib/sanity/` + `lib/sanity.ts` | Sanity-klient for menyer/ukeplan m.m. (ikke primær sidebygger). |
| `lib/public/blocks/` | Offentlig `renderBlock` + overlay. |
| `lib/content/` | Global header/footer helpers, variant-tekst. |
| `lib/backoffice/content/` | Versjonering (`pageVersionsRepo`), releases, workflow. |
| `plugins/` | `coreBlocks` (kobler til `lib/cms/blocks/registry.ts`). |
| `app/(backoffice)/backoffice/content/**` | Redaktør-UI: **primær** CMS-arbeidsflate (stor monolitt). |
| `app/(backoffice)/backoffice/preview/**` | Forhåndsvisningsside. |
| `app/api/backoffice/content/**` | API for sider, tre, publish-home, header/footer-config. |
| `app/api/backoffice/cms/**` | CMS-relaterte API (f.eks. meny-draft). |
| `app/api/content/global/**` | Global settings/header/footer for preview. |
| `app/api/page/**` | Versjoner / rollback. |
| `app/(public)/[slug]/` | Offentlig CMS-side. |
| `components/cms/` | Blokk-UI, renderer-wrapper, preview-komponenter. |
| `components/blocks/` | Blokkpresentasjon + enterprise registry views. |
| `tests/cms/` | Tester for blokker, preview-paritet, persistens. |
| `studio/` | Sanity Studio (meny, productPlan, `schemaTypes/page.ts` m.m.). |
| `scripts/sanity-live.mjs` | CI/operasjon for Sanity. |

## Indirekte (påvirker CMS)

- `lib/ai/pageBuilder.ts`, `normalizeCmsBlocks`, `cmsAiEngine.ts`, `pageBuilderValidate.ts` — AI-generering og patch på blokker.
- `lib/layout/globalHeaderFromCms.ts`, `globalFooterFromCms.ts` — krom fra CMS.
- `app/api/backoffice/ai/**` — mange ruter som skriver/forbedrer innhold (ikke alle listet enkeltvis; inngår i audit som *avhengighet* til editoren).

## Duplikater / død kode / tvilsom relevans

| Funn | Filer |
|------|--------|
| **Duplikat Sanity-prosjekt** | `studio/lunchportalen-studio/` — egen `sanity.config.ts` / `package.json`; risiko for å vedlikeholde feil workspace. |
| **Orphan schema-mappe** | `studio/schemas/` (`weekPlan.ts`, `dish.ts`, `index.ts`) — **ikke** importert av `studio/sanity.config.ts` (som bruker `./schemaTypes`). Trolig død eller eldre spor. |
| **Placeholder** | `app/.../content/_components/_stubs.ts` — `Editor2Shell` eksplisitt dokumentert som ubrukt. |
| **Sanity `page`-dokument** | `studio/schemaTypes/page.ts` — enkel Portable Text-side; **ikke** samme modell som Supabase `content_pages` + JSON-blokker. |

## Gruppering per ansvar (fil / filgruppe)

### A. `lib/cms/` (69 filer)

- **Blokker & registry:** `blocks/registry.ts` (CORE_CMS_BLOCK_DEFINITIONS), `blocks/componentRegistry.ts` (40+ AI-felt), `blocks/componentGroups.ts`, `blocks/enterpriseBlockTypes.ts`, `blocks/blockContracts.ts`.
- **Legacy → enterprise:** `blockTypeMap.ts` (mapping + `adaptLegacyBlockDataForRegistry` — stor).
- **Render-støtte:** `public/normalizeBlockForRender.ts`, `public/parseBody.ts`, `public/getContentBySlug.ts`, `public/loadLivePageContent.ts`, `public/cmsPageMetadata.ts`.
- **Media:** `media/resolveMedia.ts`, `media/resolveBlockMediaDeep.ts`, `media/publishedAssetRef.ts`, `media/syncResolvePublishedImages.ts`.
- **Design:** `design/designContract.ts`, `design/getDesignSettings.ts`.
- **Sikkerhet:** `enforceBlockSafety.ts`, `enforceBlockSafety` bruker `COMPONENT_REGISTRY`.
- **Øvrig:** `cache.ts`, `cmsContent.ts`, `writeGlobal.ts`, `readGlobal.ts`, `publishGlobal.ts`, `reorderBlocks.ts`, `model/*`, `plugins/*`, `overlays/*`, `health/pageHealth.ts`, m.fl.

### B. `app/(backoffice)/backoffice/content/` (118 filer)

- **Monolitt:** `ContentWorkspace.tsx` (~9900 linjer) — state, lagring, AI-paneler, tre, preview, modal, outbox.
- **Blokklogikk:** `contentWorkspace.blocks.ts`, `editorBlockTypes.ts`, `blockFieldSchemas.ts`, `blockValidation.ts`, `blockLabels.ts`, `useContentWorkspaceBlocks.ts`.
- **Preview:** `PreviewCanvas.tsx`, `LivePreviewPanel.tsx`, `VisualInlineBlockChrome.tsx`.
- **UI:** `BlockCanvas.tsx`, `BlockInspectorShell.tsx`, `BlockInspectorFields.tsx`, `SchemaDrivenBlockForm.tsx`, `BlockPickerOverlay.tsx`, mange `Editor*Panel.tsx`.
- **Tre:** `_tree/ContentTree.tsx`, `TreeNodeRow.tsx`.
- **Actions:** `_actions/generateAiPageDraft.ts`.

### C. `components/cms/` (11 filer)

- `CmsBlockRenderer.tsx` (server), `BlockPreview.tsx`, `BlockCard.tsx`, `BlockToolbar.tsx`, `SortableBlockWrapper.tsx`, `BlockDragHandle.tsx`, m.fl.

### D. `components/blocks/` (65 filer)

- `EnterpriseLockedBlockView.tsx` — stor `switch` på `AiComponentType`.
- `EnterpriseLockedBlockBridge.tsx`, `enterpriseRegistry/*.tsx` — tynne registry-wrappere.
- `HeroBleed.tsx`, `MarketingTextBlock.tsx`, … — presentasjonskomponenter.

### E. `lib/public/blocks/` (3 filer)

- `renderBlock.tsx` — klient/SSR-inngang til enterprise-rendering + personalisering.

### F. `studio/` (kilde, ~26 `.ts`/`.tsx` uten node_modules)

- `sanity.config.ts`, `sanity.cli.ts`, `deskStructure.ts`, `schemaTypes/*.ts`, `tools/weekPlanner/WeekPlanner.tsx`, `vite.config.ts`.

### G. `tests/cms/` (30 filer)

- `publicPreviewParity.test.ts`, `previewParity.test.ts`, `publishFlow.test.ts`, `content-persistence-save-reload.test.ts`, `blockRenderFailSafety.test.ts`, m.fl.

### H. API-ruter (utvalg)

- `app/api/backoffice/content/pages/[id]/route.ts` — GET/PATCH side + variant; **superadmin** (`requireRoleOr403(ctx, ["superadmin"])`).
- `app/api/backoffice/content/pages/route.ts` — liste/opprett; superadmin.
- `app/api/backoffice/content/publish-home/route.ts`, `build-home/route.ts`, `tree/*`, `footer-config`, `header-config/*`.

## Monorepo

- **Ikke** et npm-workspace-monorepo for CMS; **ett** Next-app + **ett** Sanity Studio under `studio/`.
- **Unntak:** `studio/lunchportalen-studio/` som nestet prosjekt — **skal** behandles som egen risiko (versjonsdrift).

## Konklusjon inventar

- **Direkte CMS:** `lib/cms`, `app/(backoffice)/backoffice/content`, `components/cms`, `components/blocks`, `lib/public/blocks`, `plugins/coreBlocks.ts`, relevante API-ruter.
- **Sanity:** operasjonelt innhold (meny/plan) **skilt** fra markedsføringssider i Supabase.
- **Største enkeltfil:** `ContentWorkspace.tsx` — egen kategori for vedlikeholdsrisiko.
