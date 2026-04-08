# POST_IMPLEMENTATION_REVIEW — kjerneleveranse

## Toppfunn (TOP_10 / audit) — status

| # | Funn | Status etter denne runden |
|---|------|---------------------------|
| 1 | Meny-regex / `select-none` | **Løst tidligere**; **utvidet** med kildefil-filter (`.md` m.fl. utenfor gate) |
| 2 | API `jsonOk`-only routes | **Løst tidligere**; **utvidet** med `superadminControlTowerJsonGet` |
| 3 | Supabase mock / system_settings | **Delvis** – produksjonslesing konsolidert via `settingsRepository`; tester ikke endret i denne runden |
| 4 | `postLoginRedirectSafety` vs E5 | **Løst** – `resolvePostLoginTarget` bruker nå `allowNextForRole` for alle roller; employee-test oppdatert |
| 5 | Motion proof test | **Tidligere** – ikke fokusert i denne runden |
| 6 | To Sanity Studio | **Delvis** – `studio/lunchportalen-studio/DEPRECATED.md` (kanon = `studio/`); ikke slettet mappe (krever deploy-bevis) |
| 7 | `archive/` | **Uendret** – ikke mål i denne runden |
| 8 | `sanity:live` i enterprise | **Uendret** |
| 9 | `settings` console → opsLog | **Tidligere** – repository-lag lagt til nå |
| 10 | ContentWorkspace monolitt | **Delvis** – **FASE 12–31** + **FASE 32 REPAIR** + **FASE 33 (2026-03-28):** page-editor shell **input assembly** flyttet til **`contentWorkspacePageEditorShellInput.ts`** (`buildContentWorkspacePageEditorShellBundle`); støtteflytting til **`contentWorkspace.blocks.ts`** / **`forsideUtils.ts`** / **`contentWorkspace.outbox.ts`** / **`runWorkspaceAiImageBatch`** i **`contentWorkspace.aiRequests.ts`**. **`ContentWorkspace.tsx`** **1986** linjer. **`blockInspectorCtx`:** uendret i FASE 33. **Preview-paritet:** samme **`blocksForLivePreview`** / **`visualInlineEditApi`** / **`blockInspectorCtx`**-kilde og -flyt; nye **FASE 33**-moduler er ikke en alternativ preview-kjede. Se **`IMPLEMENTATION_LOG.md`** (FASE 33). |
| — | `build:enterprise` / system-graph | **Løst** – `reactflow` fjernet fra `buildSystemGraph.ts` (server-bundle trygg) |

## Hva som er tydelig bedre

- **Én sannhet for post-login** (`lib/auth/role.ts` + `post-login`).
- **System settings**: eksplisitt repository + `system_settings` typet i `database.ts`.
- **Control tower**: delt HTTP-helper + CI-gate som forstår helperen.
- **Blokk-registry**: `registryManifest.ts` som manifest-inngang.
- **Preview/publisert**: `renderPipeline.ts` som dokumentert parse-entry.
- **Legacy**: tydelig `DEPRECATED` for `lunchportalen-studio`.
- **CMS workspace**: `useContentWorkspacePersistence` + `contentWorkspace.api` + `contentWorkspace.intent` — eksplisitt lag for save/status/publiser uten å duplisere PATCH-payload eller API-konvolutt i UI-filen.
- **Workspace dataflow (én sannhet):** `useContentWorkspaceData.ts` er **eneste** hook som eier list/detail/selection-sideeffekter/editor-sync for rutevalgt side; skallet **videresender** `navigation`, `editorSync`, `routeUi` og `setPage` — ingen konkurrerende `useContentWorkspacePageData`.
- **Workspace UI (FASE 6):** `useContentWorkspaceUi.ts` eier blokkvalg, preview-layout-state, legacy side-faner, inspector-derivater (`selectedBlockForInspector`, …) og panel-relaterte scroll/focus-effekter — **ikke** blokk-body eller save.
- **Global workspace shell (FASE 7):** `useContentWorkspaceShell.ts` eier `mainView` / `globalSubView` / `globalPanelTab`; **`contentWorkspace.inspector.ts`** (`buildBlockInspectorFieldsCtx`) eier inspector-objekt-oppskriften; **`ContentWorkspaceViewModeChips.tsx`** løfter Global/Design/Recycle-raden ut av monolitten.

## Preview-paritet (bevist kjeden — ikke «uendret antatt»)

**Mål:** Vise at live forhåndsvisning og lagring ikke introduserer en **parallell blokktransform** utenom den kanoniske modellen for disse flytene.

### 1) Felles parse/normalize/render (publisert / offentlig inngang)

- **Parse:** `lib/cms/public/renderPipeline.ts` re-eksporterer `parseBody` fra `parseBody.ts` — dokumentert «canonical» entry for offentlig + preview som parser **lagret body-streng**.
- **Render:** `app/(backoffice)/backoffice/content/_components/PreviewCanvas.tsx` — `PublicPageRenderer` bruker **`normalizeBlockForRender`** deretter **`renderBlock`** (samme kommentar i fil: samme pipeline som public `[slug]`).

### 2) Live preview i workspace (utkast — **blokk-array**, ikke re-parse av `bodyForSave` på hvert render)

- `LivePreviewPanel` → `PublicPageRenderer` med `blocks={blocksForLivePreview}`.
- `blocksForLivePreview` bygges fra **`displayBlocks` / `blocks`** (editor state), med unntak for historikk (`parseBodyToBlocks` på **historisk** body) og midlertidig modal-overlay — ikke en annen serializer enn `deriveBodyForSave` for hovedutkastet.
- **Ingen** alternativ «hemmelig» transform: preview går **normalizeBlockForRender → renderBlock**, ikke en separat block-type map utenom `normalizeBlockForRender` / registry.

### 3) Lagring — hva som sendes, og hva som skjer etter OK

- **Payload:** `bodyForSave` kommer fra **`useContentWorkspaceBlocks`** (`useMemo` i hook) = `deriveBodyForSave` + ev. `serializeBodyEnvelope` når `documentTypeAlias` er satt (`contentWorkspace.blocks.ts` + `_stubs`).
- **Skall:** `ContentWorkspace.tsx` sender `bodyForSave` inn i **`useContentWorkspacePersistence`** (ingen `useMemo` for body i skallet lenger for denne flyten).
- **Transport:** `useContentWorkspacePersistence` → `buildDraftSavePayload` (`contentWorkspace.persistence.ts`) → `fetchPatchContentPage` (PATCH med `locale` / `environment` fra `contentWorkspace.preview.ts` der relevant).
- **Etter vellykket save:** `performSave` mottar `next.body` fra API, kjører **`parseBodyToBlocks(next.body)`** + **`applyParsedBody(parsedBody)`** (fra hook) + oppdaterer snapshot — editor (og dermed `blocks` som driver preview) **synkes fra server** med samme parse-sti som ved første lasting.

**Konklusjon:** For **hovedutkast** er preview drevet av **samme `blocks` state** som `deriveBodyForSave` serialiserer til lagring; det finnes ikke en egen «preview-only» block-pipeline for denne flyten. Historikk-preview er eksplisitt merket (annen kilde-body).

### 4) Felt-hint i preview (FASE 4)

- **`workspaceFieldHintsForBlock`** (`contentWorkspace.blockRegistry.ts`) kaller **`getBlockFieldSchema`** + **`validateEditorField`** (`blockFieldSchemas.ts`) — samme feltdefinisjoner som redigeringskontekst, ikke en duplikat schema-tabell i skallet.

### 5) Lagring og tilbake til editor — kallrekkefølge (modulnavn)

1. **`bodyForSave`** beregnes i **`useContentWorkspaceBlocks`** (`deriveBodyForSave`, ev. `serializeBodyEnvelope` via `_stubs`).
2. **`performSave`** i **`useContentWorkspacePersistence.ts`** bygger JSON med **`buildDraftSavePayload`** (`contentWorkspace.persistence.ts`: `title`, `slug`, `body`, `rid`, ev. `updated_at`).
3. **`patchPage`** (i samme hook) sender PATCH med **`fetchPatchContentPage`** (`contentWorkspace.persistence.ts` — header `LP_CMS_CLIENT_*`, `locale`/`environment` som før).
4. Ved **`ok`**: **`parseBodyToBlocks(next.body)`** → **`deriveBodyFromParse`** (`contentWorkspace.blocks.ts`) → **`applyParsedBody`** (`useContentWorkspaceBlocks`) → **`makeSnapshot`** (`contentWorkspace.helpers.ts`) → **`setSavedSnapshot`** + **`setPage`** m.m. (hook/konsument som før).

### 5b) Live preview i samme kjede som lagring (ingen parallell «save body»)

1. **Editor `blocks`** (og ev. historikk-overlay) → **`blocksForLivePreview`** i **`ContentWorkspace.tsx`** (samme `blocks` som **`deriveBodyForSave`** serialiserer ved lagring for hovedutkast).
2. **`LivePreviewPanel`** → **`PublicPageRenderer`** i **`PreviewCanvas.tsx`** → **`normalizeBlockForRender`** → **`renderBlock`** (samme som offentlig `[slug]` via `renderPipeline` / `parseBody` for **lagret streng** — workspace bruker **blokk-array** direkte, ikke re-PATCH av `bodyForSave` på hvert tick).
3. **Offentlig forhåndsvisning/URL:** `cmsPageDetailQueryString()` (`contentWorkspace.preview.ts`) brukes på **GET detalj** i **`useContentWorkspaceData`**; **`environment=preview`** matcher server/klient for det som lastes inn — live panel bruker fortsatt **`blocks`** som sannhet, ikke en egen preview-PATCH.

### 5c) FASE 7 — global shell / inspector-adapter og preview

1. **`mainView` / `globalSubView`** styrer **hvilken hovedseksjon** som rendres — **ikke** `blocksForLivePreview`.
2. **`buildBlockInspectorFieldsCtx`** (`contentWorkspace.inspector.ts`) er **kun** kontrakt til **`BlockInspectorFields`** (høyrepanel); samme felt som før.
3. **Preview-kjede uendret:** `blocksForLivePreview` → **`LivePreviewPanel`** → **`PublicPageRenderer`** → **`normalizeBlockForRender`** → **`renderBlock`**.

### 5d) FASE 8 — overlay-hook og full-page AI-modal (preview-paritet)

1. **`useContentWorkspaceOverlays`** eier state/callbacks for full-page AI-utkast; **`onAiFullPageModalGenerate`** kaller fortsatt **`generateAiPageDraftAction`** (server action) og setter preview med **`mapSerializedAiBlockToBlock`** (`contentWorkspace.ai.ts`).
2. **`ContentWorkspaceAiFullPageModal`** rendrer **samme** **`LivePreviewPanel`** med `previewBlocks` avledet i hook — **ingen** alternativ render-pipeline; hoved-canvas-preview (`blocksForLivePreview` → `LivePreviewPanel`) er uendret i ansvar.
3. **Lagring/publiser:** uendret — overlay påvirker ikke `deriveBodyForSave` / PATCH utover eksisterende «Bruk i redigeringsfeltet» som oppdaterer `blocks` via `setBlocks` (som før).

### 5e) FASE 14 — `ContentWorkspaceMainCanvas` og preview-paritet (kallrekkefølge)

**Ingen endring i preview-pipeline** — kun flyttet JSX; state og `useMemo` forblir i **`ContentWorkspace.tsx`**.

1. **`blocksForLivePreview`** — fortsatt `useMemo` i **`ContentWorkspace.tsx`** (`historyPreviewBlocks` fra `parseBodyToBlocks(historyVersionPreview.body)` når historikk; ellers `displayBlocks`; overlay ved `editOpen` / `editModalLiveBlock`).
2. **`visualInlineEditApi`** — fortsatt `useMemo` i **`ContentWorkspace.tsx`** (deaktivert når `historyVersionPreview` er satt; ellers `PublicPageVisualInlineEdit` med `flushVisualCanvasPatches`, `onDeleteBlock`, `fieldHintsByBlockId`).
3. **`ContentWorkspaceMainCanvas`** (props fra skallet) → **`LivePreviewPanel`** (`pageTitle`, `blocks={blocksForLivePreview}`, `pageId={effectiveId}`, `selectedBlockId`, `onSelectBlock` → `setSelectedBlockId`, `hoverBlockId`, `onHoverBlock` → `setHoverBlockId`, `visualInlineEdit={visualInlineEditApi}`) → **`PublicPageRenderer`** i **`PreviewCanvas.tsx`** → **`normalizeBlockForRender`** → **`renderBlock`** (uendret kjede).
4. Full-canvas **`canvasMode === "preview"`:** **`ContentWorkspaceMainCanvas`** → **`PreviewCanvas`** (`device`, `blocks`, `title`, `meta.slug`, `pageId`) — samme komponent og props som tidligere; **ingen** alternativ blokk-transform i seksjonsfilen.
5. **`blockInspectorCtx`** bygges fortsatt med **`useBlockInspectorWorkspaceCtxFromShell`** i skallet; **`ContentWorkspaceMainCanvas`** mottar bare referansen til **`BlockInspectorFields`** på blokkkort — **ingen** ny inspector-sannhet.

### 5f) FASE 15 — workspace-krom / tri-pane shell og preview-paritet

**Ingen endring i preview-pipeline** — **`ContentWorkspaceWorkspaceShell`** er fortsatt kun layout (tre kolonner); **`ContentWorkspaceEditorChrome`** + kolonner er flyttet til **`ContentWorkspaceChrome.tsx`** uten ny forretningslogikk.

1. **`blocksForLivePreview`** / **`visualInlineEditApi`**: fortsatt `useMemo` i **`ContentWorkspace.tsx`** (uendret avhengigheter). Verdiene passes inn i **`ContentWorkspaceChrome`** via prop **`mainCanvas`** → **`ContentWorkspaceMainCanvas`** (samme feltnavn som før).
2. **Senterkolonne:** **`EditorCanvas`** → **`ContentWorkspaceMainCanvas`** med **identisk `ContentWorkspaceMainCanvasProps`** — **`LivePreviewPanel`** / **`PreviewCanvas`** / **`normalizeBlockForRender`** → **`renderBlock`** uendret; **ingen** alternativ render-logikk i den nye shell-filen.
3. **Venstre (innholds-tab):** **`LeftSidebar`** + struktur/AI-slot JSX ligger nå i **`ContentWorkspaceChrome.tsx`**; legacy **`aside`** (ytterst til venstre) ligger i **`ContentWorkspaceLegacySidebar.tsx`**.
4. **`blockInspectorCtx`:** **ikke** endret i denne fasen — bygges fortsatt i **`ContentWorkspace.tsx`** med **`useBlockInspectorWorkspaceCtxFromShell`** og sendes inn som del av **`mainCanvas`** / **`propertiesRail`**.
5. **Historikk:** **`ContentWorkspaceEditorLowerControls`** lå tidligere som **søskn** til **`ContentWorkspaceChrome`**; **FASE 16** flytter den inn i **`ContentWorkspaceAuxiliaryShell`** (fortsatt etter chrome i samme fragment).

### 5g) FASE 16 — workspace frame, auxiliary shell, modal shell og preview-paritet

**Ingen endring i preview-pipeline** — **`ContentWorkspaceChrome`** / **`ContentWorkspaceMainCanvas`** er uendret i ansvar; **`blocksForLivePreview`**, **`visualInlineEditApi`** og **`blockInspectorCtx`** bygges fortsatt i **`ContentWorkspace.tsx`** og passes inn i **`ContentWorkspaceChrome`** via **`mainCanvas`** / **`propertiesRail`** (samme feltnavn som FASE 15).

1. **`ContentWorkspaceWorkspaceFrame`**: kun ytre layout + **`legacySidebar`**-node + **`children`** (hovedkolonne). **Ingen** ny preview-kilde.
2. **`ContentWorkspaceAuxiliaryShell`**: presentasjon under editor (save, demo, AI-rader); **ingen** endring av preview-kjede.
3. **`ContentWorkspaceModalShell`**: **`ContentWorkspaceModalStack`** (`stack`-prop) + onboarding + pitch; **ingen** alternativ blokk-transform eller preview-gren.
4. **`blockInspectorCtx`:** **ikke endret i denne runden** — fortsatt fra **`useBlockInspectorWorkspaceCtxFromShell`** i **`ContentWorkspace.tsx`**.

### 5h) FASE 16B — shell prop-builders og preview-paritet

**Ingen endring i preview-pipeline** — **`buildContentWorkspaceAuxiliaryShellProps`** / **`buildContentWorkspaceModalShellProps`** er **kun** ren mapping til props-objekter; de introduserer ikke ny render-kjede eller alternativ blokk-transform.

1. **`blocksForLivePreview`** / **`visualInlineEditApi`** / **`blockInspectorCtx`:** fortsatt samme kilde og **`ContentWorkspaceChrome`** → **`ContentWorkspaceMainCanvas`**-kjede som i FASE 15–16.
2. **Modal- og auxiliary-builders** mottar samme callbacks/state som tidligere inline `stack` / auxiliary-props; **ingen** ny inspector-sannhet.

### 5i) FASE 17 — chrome props-builder, globale shell-stiler og preview-paritet

**Ingen endring i preview-pipeline.** `buildContentWorkspaceChromeProps` er **kun** ren mapping til props som allerede ble sendt til `ContentWorkspaceChrome` (før: fire nøstede objekter; etter: `ContentWorkspaceChromeProps` bygget i samme modul). **Ingen** ny render-kjede eller alternativ blokk-transform.

1. **`blocksForLivePreview`**, **`visualInlineEditApi`**, **`blockInspectorCtx`:** samme kilder og samme felt inn i `mainCanvas` som før FASE 17; nye ctx-/builder-objekter er **pass-through** og introduserer **ingen** alternativ logikk i `ContentWorkspaceMainCanvas`.
2. **`buildContentWorkspaceModalShellProps`:** samme `BuildContentWorkspaceModalShellPropsArgs`-nøkler og verdier; parent bruker **færre linjer** ved å liste flere korte nøkler per linje (ingen signatur- eller runtime-endring).
3. **`ContentWorkspaceShellGlobalStyles`:** samme globale CSS som tidligere `<style jsx global>` i `ContentWorkspace.tsx`.

### 5j) FASE 18 — tri-pane wire-builders, `ContentWorkspaceTriPaneMount` og preview-paritet

**Ingen endring i preview-pipeline.** `buildChromeShellWireInput` og `buildAuxiliaryShellWireInput` er **kun** ren pass-through til eksisterende `chromeShell*` / `auxiliaryShell*`-fabrikker; `ContentWorkspaceTriPaneMount` kaller `buildWorkspaceChromeShellPropsFromWire` og `buildContentWorkspaceAuxiliaryShellProps(buildWorkspaceAuxiliaryShellArgs(...))` som før — **samme** `ContentWorkspaceChrome` / `ContentWorkspaceAuxiliaryShell`-kjede.

1. **`blocksForLivePreview`**, **`visualInlineEditApi`**, **`blockInspectorCtx`:** samme kilder og samme felt inn i `chromeShellMain` / `mainCanvas` som før FASE 18; nye wire-/mount-moduler introduserer **ingen** alternativ render-logikk.
2. **Ctx-/input-helpers** er **kun** flyttet eierskap av orkestrering (mapping av eksisterende state/callbacks til wire-objekter); **ingen** ny hook-domene eller preview-kilde.

### 5k) FASE 19 — modularisert shell-input og preview-paritet

**Ingen endring i preview-pipeline.** FASE 19 flytter **kun** filgrenser: chrome-input og auxiliary-input i egne moduler; **`contentWorkspaceShellInputContexts.ts`** er **barrel**; **`ContentWorkspaceTriPaneMountProps`** typed **`chromeWire` / `auxiliaryWire`**. **Ingen** ny render-kjede.

1. **`blocksForLivePreview`**, **`visualInlineEditApi`**, **`blockInspectorCtx`:** samme kilder og samme felt inn i **`chromeShellMain`** via **`ChromeShellWireInput.main`** som før FASE 19; **ingen** alternativ transform.
2. **Fjernet** posisjonelle **`buildChromeShellWireInput` / `buildAuxiliaryShellWireInput`** — parent bygger **samme** wire-struktur med **objektformede** grupper (`frame`, `shared`, `editor`, …).

### 5l) FASE 20 — presentasjons-state/selectors og preview-paritet

**Ingen endring i preview-pipeline.** `blocksForLivePreview`, **`visualInlineEditApi`**, **`blockInspectorCtx`** bygges fortsatt i **`ContentWorkspace.tsx`** med samme `useMemo`/`useBlockInspectorWorkspaceCtxFromShell` som før FASE 20. **`useContentWorkspacePresentationState`** eier **kun** UI-/paneltilstand (liste, global design, mediapicker); **`contentWorkspacePresentationSelectors`** er **pure** funksjoner — **ingen** alternativ render-kjede.

### 5m) FASE 21 — UI-actions, action-groups og preview-paritet

**Ingen endring i preview-pipeline.** `blocksForLivePreview`, **`visualInlineEditApi`**, **`blockInspectorCtx`** bygges fortsatt i **`ContentWorkspace.tsx`** med samme `useMemo`/`useBlockInspectorWorkspaceCtxFromShell` som før FASE 21. FASE 22 flyttet rail-slot-gruppering til **`contentWorkspaceRightRailSlots.ts`** (tidligere **`contentWorkspaceActionGroups.ts`**); **`useContentWorkspaceUiActions.ts`** inneholder fortsatt **tynne** callbacks (`useContentWorkspaceOpenPublicPage`, `useContentWorkspacePendingNavigationActions`, `useContentWorkspaceSectionRailPlacement`) — **ingen** alternativ render-kjede eller ny blokk-transform.

### 5n) FASE 22 — right-rail VM/slots og preview-paritet

**Ingen endring i preview-pipeline.** `blocksForLivePreview`, **`visualInlineEditApi`**, **`blockInspectorCtx`** bygges fortsatt i **`ContentWorkspace.tsx`** med samme `useMemo`/`useBlockInspectorWorkspaceCtxFromShell` som før FASE 22. **`useContentWorkspaceRightRailSlots`** eier **kun** høyre-rail slot-`useMemo` + `buildRightRailSlotsFromWorkspaceArgs` (samme `buildContentWorkspaceRightRailSlots`-kjede som FASE 21); **`RightRailSlotsWorkspaceParams`** er **type-snitt** av eksisterende rail-props — **ingen** alternativ render-logikk. **`chromeShellProperties`** i tri-pane wire er **uendret** i ansvar (fortsatt `chromeShellProperties` fra shell-input).

### 5o) FASE 23 — chrome-/modal-shell VM og preview-paritet

**Ingen endring i preview-pipeline.** `blocksForLivePreview`, **`visualInlineEditApi`**, **`blockInspectorCtx`** bygges fortsatt i **`ContentWorkspace.tsx`** med samme `useMemo`/`useBlockInspectorWorkspaceCtxFromShell` som før FASE 23. **`useHistoryPreviewBlocksForChromeShell`** er **kun** flyttet `useMemo` (parse + `normalizeBlocks` på historisk body) — **samme** input/output som før. **`useEditorChromePublishRailState`**, support snapshot (I4) og overlay-effects er **presentasjon/Chrome-modal wiring** uten alternativ render-kjede. **`ContentWorkspaceTriPaneMount`** / **`buildContentWorkspaceModalShellProps`** er **uendret** i kontrakt (samme props til samme komponenter).

### 5p) FASE 24 — tri-pane wire-buildere, modal-shell importflate, shell-fragmenter og preview-paritet

**Ingen endring i preview-pipeline.** `blocksForLivePreview`, **`visualInlineEditApi`**, **`blockInspectorCtx`** bygges fortsatt i **`ContentWorkspace.tsx`** med samme `useMemo`/`useBlockInspectorWorkspaceCtxFromShell` som før FASE 24. **`buildContentWorkspaceTriPaneMountChromeWire`** / **`buildContentWorkspaceTriPaneMountAuxiliaryWire`** er **kun** gruppering av eksisterende `chromeShell*` / `auxiliaryShell*`-resultater inn i **`ChromeShellWireInput`** / **`AuxiliaryShellWireInput`** (samme som tidligere inline `{ frame: …, shared: … }`). **`contentWorkspaceModalShellInput.ts`** re-eksporterer **`buildContentWorkspaceModalShellProps`** og **`ContentWorkspaceModalShell`** uten å endre builder-logikk. Nye shell-komponenter (konflikt, pending navigasjon, dev-HUD, route-placeholders, design tab-header) er **verbatim** JSX-flytting — **ingen** alternativ render-kjede for live preview.

### 5q) FASE 25 — chrome-shell args-hooks (`useChromeVisualPreviewShellPair`, `useContentWorkspaceUrlModeFlags`) og preview-paritet

**`blocksForLivePreview`** bygges i **`ContentWorkspace.tsx`** som før (samme `useMemo` + `displayBlocks` / `editModalLiveBlock`). **`visualInlineEditApi`** og **`visualPreviewFieldHints`** er fortsatt **samme to** `useMemo`-kjeder som før FASE 25, nå flyttet inn i **`useChromeVisualPreviewShellPair`** i **`contentWorkspaceChromeShellArgs.ts`** (kaller **`buildVisualPreviewFieldHintsMap`** / **`buildVisualInlineEditApiForChromeShell`** — samme hjelpere og `useMemo`-avhengigheter). **`blockInspectorCtx`** er **ikke endret** i denne runden (samme **`useBlockInspectorWorkspaceCtxFromShell`**-kall). **Ingen** alternativ preview-render-logikk; nye moduler er **kun** pass-through / presentasjon.

### 5r) FASE 26 / 26B / 27 — tri-pane chrome/auxiliary slice-moduler og preview-paritet

**Ingen endring i preview-pipeline.** `blocksForLivePreview`, **`visualInlineEditApi`**, **`blockInspectorCtx`** bygges og sendes inn i **`main`** **som før** ( **`buildChromeShellMainOnlyFromFields`** er pass-through til **`chromeShellMain`** — **samme** feltverdier som FASE 26B-objektet). **`shared`** / **`editor`** / **`properties`** / **`tri`** er nå **`ChromeShell*`-objekter** (FASE 27) levert via **`buildChromeShell*SliceFromFields`**; **`buildContentWorkspaceTriPaneMountChromeWireFromWorkspaceSlices`** kaller **`buildContentWorkspaceTriPaneMountChromeWire`** med **identisk** wire. **`aiPitch`:** **`buildAuxiliaryShellAiPitchFromFields`**. **Modal:** **`buildContentWorkspaceModalShellPropsFromWorkspaceFlatFields`** → **`buildContentWorkspaceModalShellProps`**. **`contentWorkspaceTriPaneShellBundle.ts`** er **kun** re-eksport. **Ingen** alternativ render-kjede.

### 5s) FASE 29 — design mainView shell (Layout / Logo / Colors / Fonts / Backgrounds) og preview-paritet

**Ingen endring i preview-pipeline.** `blocksForLivePreview`, **`visualInlineEditApi`**, **`blockInspectorCtx`** bygges fortsatt i **`ContentWorkspace.tsx`** med samme `useMemo` / `useBlockInspectorWorkspaceCtxFromShell` som før FASE 29. **`ContentWorkspaceMainViewShell`**, **`ContentWorkspaceMainViewShellColorsLead`**, **`ContentWorkspaceMainViewShellColorsContinuation`** og **`ContentWorkspaceMainViewShellCont`** er **kun** flyttet **design**-presentasjons-JSX (farge-/etikett-state fortsatt fra **`useContentWorkspacePresentationState`** via props); **ingen** ny hook-domene eller alternativ blokk-/preview-render.

### 5t) FASE 30 — global «Innhold og innstillinger» (content-and-settings) shell og preview-paritet

**Ingen endring i preview-pipeline.** `blocksForLivePreview`, **`visualInlineEditApi`**, **`blockInspectorCtx`** bygges fortsatt i **`ContentWorkspace.tsx`** med samme `useMemo` / `useBlockInspectorWorkspaceCtxFromShell` som før FASE 30. **`ContentWorkspaceGlobalMainViewShell`** og **`ContentWorkspaceGlobalMainViewShellCont`** er **kun** flyttet **global**-presentasjons-JSX for **`globalSubView === "content-and-settings"`** (underfaner, Generell, Analytics, Skjema, globalt innhold, varsling, scripts, avansert, lagre-rad); state (**`contentSettingsTab`**, retning, e-postplattform, CAPTCHA, varsling) kommer uendret fra **`useContentWorkspaceOverlays`** / **`useContentWorkspacePresentationState`** via props. **Ingen** alternativ blokk-/preview-render og **ingen** endring av **`mainCanvas`** / **`LivePreviewPanel`**-kjeden.

### 5u) FASE 31 — gjenværende global-mainView-grener (reusable, header, footer, navigation, global rot) og preview-paritet

**Ingen endring i preview-pipeline.** `blocksForLivePreview`, **`visualInlineEditApi`**, **`blockInspectorCtx`** bygges fortsatt i **`ContentWorkspace.tsx`** med samme `useMemo` / `useBlockInspectorWorkspaceCtxFromShell` som før FASE 31. **`ContentWorkspaceGlobalGlobalBranchShell`** og de dedikerte **global**-shell-filene er **kun** flyttet presentasjons-JSX + **samme** props-pass-through (state for **header** / **footer** / **navigation** / **global rot** kommer uendret fra **`useContentWorkspacePresentationState`**, **`useContentWorkspaceOverlays`**, **`useContentWorkspaceShell`**). **Ingen** alternativ blokk-/preview-render og **ingen** endring av **`mainCanvas`** / **`LivePreviewPanel`**-kjeden.

### 6) Innlasting valgt side → editor (én modul)

1. **`useContentWorkspaceData`**, list-`useEffect`: `GET /api/backoffice/content/pages`.
2. **`useContentWorkspaceData`**, detail-`useEffect`: `GET /api/backoffice/content/pages/[id]?` + `cmsPageDetailQueryString()` → `_stubs`: `parseBodyEnvelope` → `contentWorkspace.blocks`: `parseBodyToBlocks` → **`setPage(next)`** → **`detailLoadRef.current.applyLoadedPage`** (**`assignDetailLoadRef`** + **`editorSync`** i **`useContentWorkspaceData.ts`**).
3. **`detailRunIdRef`**: ugyldiggjør in-flight detalj når `selectedId` tømmes — **kun** i **`useContentWorkspaceData.ts`** (stabilitetstester: `tests/cms/contentWorkspaceStability.smoke.test.ts`).

### 7) Live preview — inn i samme render-kjede som før

1. **`blocksForLivePreview`** (arve fra `blocks` etter `applyParsedBody` / last) i **`ContentWorkspace.tsx`**.
2. **`LivePreviewPanel`** → **`PublicPageRenderer`** (`PreviewCanvas.tsx`) → **`normalizeBlockForRender`** → **`renderBlock`** (offentlig pipeline; ikke egen «preview-only» serializer for hovedutkast).

## Gjenværende risiko

- `ContentWorkspace.tsx` er **~2190** linjer (etter **FASE 32 REPAIR**). **Største gjenværende strukturelle svakhet:** parent eier fortsatt **lange** **tri-pane**-bundle-objekter (**`triPaneBundleInput`** med **chrome**-tupler + **`buildAuxiliaryShellAiPitchFromFields`**), **design/global**-props til **`ContentWorkspacePageEditorShell`**, **modal**-flat-field-builder, og **AI-/save-/outbox-**/`useCallback`-flater — **ikke** løst ved shell-ekstraksjon alene.
- `withDefaults` bruker `unknown`-cast fra DB-rad; **neste steg** er Zod eller genererte typer på jsonb ved grense (delvis forberedt i `systemSettingsSchema`).
- `LoosePublicTable` dekker fortsatt mange tabeller – `system_settings` er unntak.
- **`build:enterprise` / Node-minne:** `next build` (TypeScript + kompilering + statisk analyse av hele appen) er det tunge steget; uten `NODE_OPTIONS=--max-old-space-size=8192` kan prosessen feile med heap OOM på store arbeidsmaskiner. Det er **mitigering**, ikke dokumentasjon av at bygget er «lett» — gjenværende risiko inntil heap uten heving er verifisert i CI.

## Vurdering

Plattformen er **nærmere** profesjonell kilde-sannhet (auth, settings, API-helper, CMS-manifest, preview-entry), men **ikke** «ferdig» på Umbraco-nivå før mer CMS-utbrytning og runtime-validering på jsonb-grenser.

**Ærlig om «shell»:** `ContentWorkspace.tsx` **eier fortsatt** ~2,2k linjer (etter FASE 15–32 REPAIR); den **kompilerer** `editorSync`/`navigation` til `useContentWorkspaceData` og konsumerer `guardPush`/`selectContentPage`/`reloadDetailFromServer`, men er **ikke** en ren komposisjonsfil — målt linjetall og gjenværende ansvar er dokumentert over.
