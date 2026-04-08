# IMPLEMENTATION_LOG — kjernearkitektur (pågående)

Alle tider UTC-agnostiske (lokal kjøring).

## FASE 15 baseline for tracked ContentWorkspace shell

**Branch:** `rescue-ai-restore` (lokal verifisering 2026-03-27).  
**Filsti:** `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` (sporet i git).  
**Linjetall før FASE 15-uttrekk (tracked working tree):** **6401** linjer (`Measure-Object -Line` i PowerShell).  
**Git:** fil markert **M** (modified) i denne kopien — baseline er **faktisk innhold på disk** for denne runden.  
**Merk:** Eventuelle **untracked** filer andre steder i repoet er **ikke** del av denne fasen (kun notert).

### Gjenværende workspace-krom-/layout-shell-komposisjon i ContentWorkspace før FASE 15

Før uttrekk lå følgende **skall** fortsatt i `ContentWorkspace.tsx`:

- **Toppnivå layout:** `div` med `hideLegacySidebar` → enten `flex` full bredde eller `md:grid-cols-[280px_minmax(0,1fr)]` + **`section`** for hovedinnhold.
- **Legacy venstrekolonne (`aside`):** «Content»-header, **Hjem**-knapp + sideliste, **ContentWorkspaceViewModeChips** (Global/Design), søk + liste, placeholder-rader (tjenester/innstillinger), **create-panel** (dialog for ny side).
- **Innholds-tab (page + editor):** **`ContentWorkspaceEditorChrome`** (topbar, outbox, tittel, preview-enhet) + **`ContentWorkspaceWorkspaceShell`** med **`LeftSidebar`** (struktur/AI), **`EditorCanvas`** + **`ContentWorkspaceMainCanvas`**, **`RightPanel`** + **`ContentWorkspacePropertiesRail`** + høyre-rail slots.
- **Under tri-pane:** **`ContentWorkspaceEditorLowerControls`** (historikk + save bar), deretter demo/AI-rader i samme fragment som før.
- **Modal-stack:** **`ContentWorkspaceModalStack`** nederst i filen (uendret i denne fasen).

**Ikke mål i denne fasen:** `blocksForLivePreview` / `visualInlineEditApi` `useMemo`, `blockInspectorCtx`-hook, data-/save-hooks, API.

---

## 2026-03-27 — FASE 15: `ContentWorkspaceLegacySidebar` + `ContentWorkspaceChrome`

### Hva som ble flyttet

| Ny fil | Innhold (skall kun) |
|--------|---------------------|
| **`ContentWorkspaceLegacySidebar.tsx`** | Hele legacy **`aside`**: Hjem, view-mode chips, søk/liste, placeholders, **create-panel** overlay. Props fra skallet; `normalizeSlug` injisert som callback (én sannhet i `ContentWorkspace.tsx`). |
| **`ContentWorkspaceChrome.tsx`** | **`ContentWorkspaceEditorChrome`** + (når `isContentTab`) **`ContentWorkspaceWorkspaceShell`** med **`LeftSidebar`**, **`EditorCanvas`** + **`ContentWorkspaceMainCanvas`**, **`RightPanel`** + **`ContentWorkspacePropertiesRail`**. Mottar `editorChrome`, `mainCanvas`, `propertiesRail`, `triPaneLeft`, `rightRailSlots` — **samme props** som tidligere JSX, kun gruppert. |

`ContentWorkspace.tsx`: ytre grid + `section` uendret; legacy sidebar erstattet med én komponent; editor-blokken erstattet med **`<>`** + **`ContentWorkspaceChrome`** + eksisterende **`ContentWorkspaceEditorLowerControls`** + resten. **`statusTone`** (liste-status) duplisert som `listStatusTone` i legacy-sidebar-filen; fjernet ubrukt `statusTone` fra `ContentWorkspace.tsx`.

### Preview-paritet

**Ingen endring** i render-kjede: `ContentWorkspaceMainCanvas` får fortsatt identisk `mainCanvas`-objekt (inkl. `blocksForLivePreview`, `visualInlineEditApi`, `blockInspectorCtx`). Se oppdatert avsnitt i `POST_IMPLEMENTATION_REVIEW.md` (FASE 15).

### Kommandoer (verifisert 2026-03-27)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS (193 filer, 1133 tester) |
| `npm run build:enterprise` med `NODE_OPTIONS=--max-old-space-size=8192` | PASS |

**Linjetall etter uttrekk:** `ContentWorkspace.tsx` **6044** linjer; `ContentWorkspaceLegacySidebar.tsx` **467**; `ContentWorkspaceChrome.tsx` **180** (`Measure-Object -Line`).

---

## FASE 16 baseline for tracked ContentWorkspace shell

**Dato:** 2026-03-27 (lokal verifisering).

| Fil | Linjetall (`(Get-Content …).Count` i PowerShell) | Git-status (før FASE 16-staging) |
|-----|---------------------------------------------------|----------------------------------|
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | **6081** (etter FASE 16-impl.) | **M** (modified); må stages med øvrige shell-endringer |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceChrome.tsx` | **188** | **A** eller **M** avhengig av branch — stages ved berøring |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceLegacySidebar.tsx` | **482** | **A** eller **M** — stages ved berøring |

**Nye / endrede shell-filer i FASE 16 (skal stages i samme runde):** `ContentWorkspaceWorkspaceFrame.tsx`, `ContentWorkspaceModalShell.tsx`, `ContentWorkspaceAuxiliaryShell.tsx` (+ ev. `ContentWorkspace.tsx`).

### Gjenværende top-level shell i ContentWorkspace før FASE 16

Før uttrekk lå fortsatt i **`ContentWorkspace.tsx`**:

- **Ytre workspace-layout:** `div` (`hideLegacySidebar` → flex vs `md:grid-cols-[280px_minmax(0,1fr)]`) + **`section`** + inner **`div`** (`w-full min-w-0 px-4 py-6`) som rammet pending navigasjon + alle `mainView`-grener.
- **Under tri-pane (kun komposisjon):** **`ContentWorkspaceEditorLowerControls`**, demo (WOW), AI-inndata / build / audit, **`aiBuildResult`**, valgt-blokk AI-verktøy, batch-progress, **`aiImages`** — alt i samme fragment etter **`ContentWorkspaceChrome`**.
- **Modal-/overlay-stack:** **`ContentWorkspaceModalStack`** + onboarding (`onboardingStep`, `ONBOARDING_DONE_KEY`) + pitch-overlay (`isPitch`, `pitchStep`) — ren JSX + callback-wiring fra skallet.

**Ikke mål:** `blocksForLivePreview` / `visualInlineEditApi` / `blockInspectorCtx`-hooks, save/publish, blokkmodell, API.

---

## 2026-03-27 — FASE 16: `ContentWorkspaceWorkspaceFrame` + `ContentWorkspaceModalShell` + `ContentWorkspaceAuxiliaryShell`

### Hva som ble flyttet

| Ny fil | Innhold (skall kun) |
|--------|---------------------|
| **`ContentWorkspaceWorkspaceFrame.tsx`** | Ytre grid/flex + **`section`** + padded hovedkolonne; `legacySidebar` + `children` (mount points). |
| **`ContentWorkspaceModalShell.tsx`** | **`ContentWorkspaceModalStack`** (`stack`-prop) + onboarding-overlay + pitch-overlay; callbacks som props. |
| **`ContentWorkspaceAuxiliaryShell.tsx`** | **`ContentWorkspaceEditorLowerControls`** + demo + AI-rader + build-resultat + blokk-AI + batch + bilde-grid; props-only. |

**`ContentWorkspace.tsx`:** Erstatter ytre `div`/`section`/padding med **`ContentWorkspaceWorkspaceFrame`**; flytter under-editor-flater til **`ContentWorkspaceAuxiliaryShell`**; flytter modal-stack + overlays til **`ContentWorkspaceModalShell`**. **Store** `lowerControls`- og `stack`-objekter forblir **inline i parent** (samme wiring som før FASE 16) — **ingen** ny forretningslogikk.

**Linjetall etter FASE 16:** `ContentWorkspace.tsx` **6081**; `ContentWorkspaceWorkspaceFrame.tsx` **37**; `ContentWorkspaceModalShell.tsx` **169**; `ContentWorkspaceAuxiliaryShell.tsx` **267** (`Measure-Object`-ekvivalent: `(Get-Content …).Count`).

**Merk:** Sammenlignet med FASE 15-tallet **6044** i loggen kan totalen i **`ContentWorkspace.tsx`** øke noe fordi modal- og auxiliary-wiring fortsatt er **utførlige prop-objekter** i samme fil; reell gevinst er **modulær eierskap** og tynnere **return**-struktur (layout/modal/aux som egne filer).

### Kommandoer (verifisert 2026-03-27)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings + `@next/next/no-img-element` i `ContentWorkspaceAuxiliaryShell.tsx` for `<img>`-ruten) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

---

## FASE 16B baseline for tracked shell-wiring reduction

**Dato:** 2026-03-27 (lokal verifisering).

| Fil | Linjetall (`(Get-Content …).Count`) | Git-status (ved start av FASE 16B) |
|-----|--------------------------------------|-------------------------------------|
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | **6081** (før 16B-prop-builders) | **M** |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceWorkspaceFrame.tsx` | **37** | **A** (evt. **M**) |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceModalShell.tsx` | **169** | **A** (evt. **M**) |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceAuxiliaryShell.tsx` | **267** | **A** (evt. **M**) |

### Gjenværende wiring-monolitt i ContentWorkspace før FASE 16B

Etter FASE 16 lå fortsatt i **`ContentWorkspace.tsx`**:

- **Inline `stack`-objekt** til **`ContentWorkspaceModalShell`** (full **`ContentWorkspaceModalStackProps`**: full-page AI, block add/picker/edit, media picker med `onPick` / `onSelect`).
- **Inline auxiliary-props** til **`ContentWorkspaceAuxiliaryShell`**: **`lowerControls`** ( **`versionHistory`** med lang **`onApplyRestoredPage`** ), **`demo`**, **`aiInputs`**, **`onApplyAiBuild`**, **`selectedBlockTools`**, m.m.
- Alt dette var **ren pass-through-samling** av eksisterende state/settere/callbacks — ingen ny domene-sannhet, men **hundrevis av linjer** i parent.

---

## 2026-03-27 — FASE 16B: `contentWorkspaceModalShellProps.ts` + `contentWorkspaceAuxiliaryShellProps.ts`

### Hva som ble flyttet

| Ny fil | Innhold |
|--------|---------|
| **`contentWorkspaceModalShellProps.ts`** | `buildContentWorkspaceModalStackProps` + `buildContentWorkspaceModalShellProps` — samme mapping som tidligere inline `stack` + onboarding/pitch-callbacks. |
| **`contentWorkspaceAuxiliaryShellProps.ts`** | `buildContentWorkspaceAuxiliaryShellProps` — samme mapping som tidligere inline auxiliary-props (inkl. **`lowerControls.versionHistory.onApplyRestoredPage`**). |

**`ContentWorkspace.tsx`:** Ett kall **`{...buildContentWorkspaceAuxiliaryShellProps({ ... })}`** og **`{...buildContentWorkspaceModalShellProps({ ... })}`** med eksplisitte argumenter — **ingen** ny logikk, **ingen** nye hooks.

**Linjetall etter FASE 16B:** `ContentWorkspace.tsx` **5885**; `contentWorkspaceModalShellProps.ts` **259**; `contentWorkspaceAuxiliaryShellProps.ts` **220** (`(Get-Content …).Count`). **Under FASE 15-baseline 6044** (akseptkriterium).

### Kommandoer (verifisert 2026-03-27)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

---

## FASE 17 baseline for tracked shell orchestration reduction

**Dato:** 2026-03-27 (lokal verifisering umiddelbart før FASE 17-reduksjon).

| Fil | Linjetall (`(Get-Content …).Count`) | Merknad |
|-----|-------------------------------------|---------|
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | **5823** (før modal-kompresjon i FASE 17; FASE 16B-referanse i logg: **5885**) | **M** i arbeidskopi |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceModalShellProps.ts` | **259** | typed builders uendret i signatur |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceAuxiliaryShellProps.ts` | **220** | typed builder uendret i signatur |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceChrome.tsx` | **188** | ikke endret i FASE 17 |

### Gjenværende shell orchestration-monolitt i ContentWorkspace før FASE 17

- **`ContentWorkspaceChrome`:** Fire store nøstede objekter (`editorChrome`, `mainCanvas`, `propertiesRail`, `triPaneLeft`) pluss `rightRailSlots` — ren pass-through av state/callbacks.
- **`buildContentWorkspaceModalShellProps({ ... })`:** Lang flat argumentliste (stack + onboarding/pitch) i parent.
- **`buildContentWorkspaceAuxiliaryShellProps({ ... })`:** Lang flat argumentliste (samme som FASE 16B).
- **Globale `<style jsx global>`** for animasjoner (fade-in, block-pulse) nederst i `ContentWorkspace.tsx`.

---

## 2026-03-27 — FASE 17: `contentWorkspaceChromeProps.ts` + `ContentWorkspaceShellGlobalStyles.tsx` + modal kompressjon

### Hva som ble flyttet eller komprimert

| Ny / endret fil | Innhold |
|-----------------|---------|
| **`contentWorkspaceChromeProps.ts`** | `ContentWorkspaceChromeBuildInput` + `buildContentWorkspaceChromeProps()` — bygger `editorChrome` / `mainCanvas` / `propertiesRail` / `triPaneLeft` og ytre chrome-felter; samme mapping som tidligere inline (inkl. `blocksForLivePreview`, `visualInlineEditApi`, `blockInspectorCtx` inn i `mainCanvas`). |
| **`ContentWorkspaceShellGlobalStyles.tsx`** | Globale keyframes (`animate-fade-in`, `animate-block-pulse`) — samme CSS som før. |
| **`ContentWorkspace.tsx`** | Ett kall `buildContentWorkspaceChromeProps({ ... })` i stedet for fire nøstede objekter; `buildContentWorkspaceModalShellProps`-argument **komprimert til færre linjer** (flere korte nøkler per linje, samme nøkler/verdier); `<ContentWorkspaceShellGlobalStyles />` i stedet for innebygd `<style jsx global>`. |

**Merk:** Gruppert auxiliary-helper ble **ikke** beholdt — den ville økt parent-linjetall; flat `buildContentWorkspaceAuxiliaryShellProps({ ... })` beholdes.

**Linjetall etter FASE 17:** `ContentWorkspace.tsx` **5781**; `contentWorkspaceChromeProps.ts` **296**; `ContentWorkspaceShellGlobalStyles.tsx` **39**; `contentWorkspaceModalShellProps.ts` **259**; `contentWorkspaceAuxiliaryShellProps.ts` **220**; `ContentWorkspaceChrome.tsx` **188** (`(Get-Content …).Count`).

### Kommandoer (verifisert 2026-03-27)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

---

## 2026-03-26 — Fase A/B/C/D/E (kjerne + kontrakter)

### Verifisert problem → root cause → fix

| Område | Problem | Root cause | Fix |
|--------|---------|------------|-----|
| `scripts/agents-ci.mjs` | Markdown/dokumentasjon kunne treffe meny-gate (Menu + overflow-hidden i prose); Windows-stier med `\` matchet ikke `components/...` regex | Gate skannet `.md` og brukte `rel` med backslash mot mønster som forventer `/` | Kun `.ts/.tsx/.js/.jsx/.css`; path-sjekk bruker `norm` med forward slashes |
| `scripts/agents-ci.mjs` + `scripts/ci/api-contract-enforcer.mjs` | Control tower routes uten `jsonOk`/`makeRid` i kilde etter refaktor | Statiske gates krevde literals / rid i fil | Unntak når `superadminControlTowerJsonGet` importeres fra `@/lib/http/superadminControlTowerGet` (samme tillit som `jsonOk`) |
| Control tower API | Tre kopier av auth + `jsonOk` | Ingen delt helper | `lib/http/superadminControlTowerGet.ts` — én kilde for scope → superadmin → `jsonOk(rid, data, 200)` |
| Post-login vs `lib/auth/role.ts` | `resolvePostLoginTarget` brukte ikke `allowNextForRole` for ikke-`superadmin` | Avvik fra E5 allowlist; `lib/auth/role.ts` var ikke eneste sannhet | Alle roller: `allowNextForRole(r, nextSafe) ?? landingForRole(r)`; `allowNextForRole` utvidet med `/orders` for employee |
| `tests/auth/postLoginRedirectSafety.test.ts` | Test forventet employee → `/admin` | Test reflekterte gammel implementasjon | Test forventer nå `/week` når `next=/admin` (samsvar med rolle) |
| `lib/system/settings.ts` | Ad hoc `select(*)` / duplikat kjede | Ingen repo-grense | `lib/system/settingsRepository.ts` med `fetchSystemSettingsRow` + eksplisitt kolonneliste |
| `lib/types/database.ts` | `system_settings` var full `LoosePublicTable` | Svak typet rad for kritisk tabell | Dedikert `SystemSettingsTable` med `id` + jsonb-felt |
| `src/lib/guards/assertCompanyActiveApi.ts` | `supa: any` | Ingen grense mot DB-klient | `SupabaseClient<Database>`; `unknown` i catch |
| CMS blokk | `enterpriseBlockTypes.ts` dupliserte registry-set | To innganger til samme sannhet | `lib/cms/blocks/registryManifest.ts` som kanonisk manifest; `enterpriseBlockTypes` re-eksporterer |
| Preview/publisert | `parseBody` importert fra mange steder uten «kanon» | Vanskelig å se felles pipeline | `lib/cms/public/renderPipeline.ts` — eksplisitt entry; `preview/[id]/page.tsx` og `app/(public)/page.tsx` importerer derfra |
| `ContentWorkspace.tsx` | Preview-URL + draft query spredt i monolitten | Ingen modul for preview wiring | `contentWorkspace.preview.ts` (`cmsPageDetailQueryString`, `backofficePreviewPath`, `CMS_EDITOR_LOCALE`) |
| Studio | To `sanity.config.ts` uten tydelig status | `lunchportalen-studio` hardkodet `projectId` | `studio/lunchportalen-studio/DEPRECATED.md` — kanon = `studio/` med env |

### Kategori

- **test/CI:** `agents-ci.mjs` (meny + API-contract unntak)
- **type/kontrakt:** `database.ts` (system_settings), `superadminControlTowerGet.ts`, routes
- **auth:** `role.ts`, `post-login/route.ts`
- **CMS:** `registryManifest.ts`, `ContentWorkspace` + `contentWorkspace.preview.ts`, `renderPipeline.ts`, `renderBlock.tsx` (dokumentasjon)
- **preview/render:** `renderPipeline.ts`, `preview/[id]/page.tsx`, `page.tsx` (public)
- **cleanup/legacy:** `studio/lunchportalen-studio/DEPRECATED.md`

### Kommandoer kjørt (denne runden)

| Kommando | Resultat |
|----------|------------|
| `npm run typecheck` | PASS (etter rettelser for `system_settings` Row + `withDefaults` cast) |
| `npm run agents:check` | PASS (etter `superadminControlTowerJsonGet`-unntak) |
| `npx vitest run tests/auth/postLoginRedirectSafety.test.ts` | PASS |
| `npm run lint` | PASS (kun eksisterende warnings) |

### Blockers / gjenværende

- `npm run test:run` og `npm run build:enterprise` bør kjøres fullt i CI; `build:enterprise` kan kreve `NODE_OPTIONS=--max-old-space-size=8192` på store arbeidsstasjoner.

---

## Avvik dokumentasjon vs kode

- **Post-login:** `POST_IMPLEMENTATION_REVIEW.md` og audit antok tidligere at employee kunne «navigere» til `/admin` via `next`; **kode + E5** er nå konsistente med `allowNextForRole` (test oppdatert).

---

## 2026-03-26 — FASE 1: `build:enterprise` + system-graph + CMS persist

### Root cause: `TypeError: (0 , D.createContext) is not a function` (`/api/superadmin/system-graph/data`)

| Felt | Innhold |
|------|---------|
| **Importkjede** | `route.ts` → `buildSystemGraph` (`lib/repo-intelligence/buildSystemGraph.ts`) → **`import { MarkerType } from "reactflow"`** (og `import type { Node, Edge } from "reactflow"`). |
| **Årsak** | `reactflow` er en **klientbibliotek** som ved modullasting initialiserer **React Context** (`createContext`). Når Next bundlet API-ruten for server/route collection, ble denne kjeden evaluert i et miljø der `createContext` ikke er den forventede React-funksjonen → feil ved **Collecting page data**. |
| **Ikke** | Feil i selve `GET`-handleren; feilen var **sideeffekt av import** før kjøring. |
| **Fix** | Fjern **alle** `reactflow`-imports fra `buildSystemGraph.ts`. Erstatt med `SystemGraphRfNode` / `SystemGraphRfEdge` + `MARKER_ARROW_CLOSED = "arrowclosed"` (samme verdi som `MarkerType.ArrowClosed`). |
| **Klient** | `SystemGraphClient.tsx`: `payload.nodes` / `filtered.edges` castes til `Node[]` / `Edge[]` der reactflow krever merke typer. |

**Filer endret (build):** `lib/repo-intelligence/buildSystemGraph.ts`, `app/superadmin/system-graph/SystemGraphClient.tsx`

### CMS: save/publish transport ut av `ContentWorkspace.tsx`

| Ny fil | Ansvar |
|--------|--------|
| `contentWorkspace.persistence.ts` | `fetchPatchContentPage` (én PATCH-kontrakt med header + locale/env), `buildDraftSavePayload`, `isNetworkError` |

**Endringer i `ContentWorkspace.tsx`:** `patchPage` bruker `fetchPatchContentPage`; `performSave` bruker `buildDraftSavePayload`; `isNetworkError` og duplikat `makeRidClient` fjernet (bruker `contentWorkspace.helpers.makeRidClient`); ubrukt import `LP_CMS_CLIENT_*` fjernet.

**Linjetall (FASE 1):** `ContentWorkspace.tsx` krympet i første persist-steg; se **FASE 2** nedenfor for gjeldende tall etter orkestreringsuttrekk.

### Kommandoer (verifisert etter denne fasen)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run build:enterprise` (med `NODE_OPTIONS=--max-old-space-size=8192`) | PASS |
| `npx vitest run tests/cms/editorModularizationImports.test.ts tests/cms/content-persistence-save-reload.test.ts` | PASS |

| `npm run lint` | PASS (eksisterende hook/img-warnings) |
| `npm run test:run` | PASS (193 filer, 1133 tester) |

---

## 2026-03-26 — FASE 2: save/status/publish-orkestrering ut av `ContentWorkspace.tsx`

### Hva som ble flyttet

| Tidligere i `ContentWorkspace.tsx` | Nytt hjem |
|-----------------------------------|-----------|
| `patchPage` (PATCH-respons, 409, `syncEditor`, sidebar, `router.replace`) | `useContentWorkspacePersistence.ts` |
| `performSave` (demo/offline, kø, abort, `buildDraftSavePayload`, konflikt/offline/nettverk, outbox-clear, pending chain) | Samme hook |
| `saveDraft` | Samme hook |
| `onSetStatus` (status-sekvens, abort, merge page, saveState etter dirty) | Samme hook; status-payload via `buildStatusTransitionPayload` i `contentWorkspace.intent.ts` |
| `readApiMessage` / `readApiRid` / `readApiError` / `parseJsonSafe` | `contentWorkspace.api.ts` (én kontrakt for JSON API-svar) |
| Duplikat `SaveState`, `ContentPage` / liste / `PageData` / `ApiOk`/`ApiErr` lokalt | `SaveState` fra `./types`; `ContentPage`, `ListData`, `CreateData`, `PageData` fra `ContentWorkspaceState.ts`; API-typer fra `contentWorkspace.api.ts` |
| Lokal `djb2` + `djb2(JSON.stringify(draft))` for outbox-fingeravtrykk | `fingerprintOutboxDraft` i `contentWorkspace.outbox.ts` (samme algoritme, én kilde) |

### Strukturell forbedring

- **Skall vs. lag:** `ContentWorkspace.tsx` kaller `useContentWorkspacePersistence({...})` og får `performSave`, `saveDraft`, `onSetStatus` tilbake; den eier ikke lenger transport + payload-beslutning + sekvensering i samme fil som stor UI.
- **Intent:** `contentWorkspace.intent.ts` dokumenterer at **draft body** (`buildDraftSavePayload` i `persistence.ts`) og **status transition** (`buildStatusTransitionPayload`) er samme HTTP-PATCH, ulik semantikk — ikke tre løse grener uten navn.
- **Ingen parallell sannhet:** `contentWorkspace.persistence.ts` forblir transport + draft-payload; hook orkestrerer oppå.

### Linjetall (denne runden)

| Fil | Linjer (PowerShell `(Get-Content …).Count`) |
|-----|---------------------------------------------|
| `ContentWorkspace.tsx` | **9999** |
| `useContentWorkspacePersistence.ts` | **438** |
| `contentWorkspace.api.ts` | **ny** (~55 linjer) |
| `contentWorkspace.intent.ts` | **ny** (~15 linjer) |

**Netto:** Orkestrering tilsvarende **~330+ linjer** fjernet fra workspace-filen (erstattet med kort hook-kall + imports); logikk flyttet til hook + små moduler.

### Toppfunn som reduseres

- **#10 ContentWorkspace-monolitt:** Mindre skjult kobling mellom UI-state og persistens; save/status/publish har eget modulært hjem.
- **Duplikat API-/type-definisjoner** i én gigantfil: redusert ved `contentWorkspace.api.ts` og import fra `ContentWorkspaceState`.

### Kommandoer (verifisert)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings; `useContentWorkspacePersistence` exhaustive-deps rettet for `onSetStatus`) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` — **build passes with elevated Node memory**; full eliminering av heap-risiko er ikke bevist uten kjøring uten heving |
| `npm run sanity:live` | EXIT 0 (soft gate: localhost utilgjengelig i denne økten — forventet uten kjørende server) |

### Preview

- Kortversjon: se **FASE 3** og `POST_IMPLEMENTATION_REVIEW.md` for den konkrete kjeden (live preview vs. lagring). FASE 2 antok bevisst ingen ny divergens; FASE 3 dokumenterer pipeline eksplisitt.

---

## 2026-03-26 — FASE 3: list/detail-data + shell-hydrering + block reorder (mindre monolitt)

### A) Faktisk linjetall og avvik (9805 vs 9999)

| Kilde | Tall | Metode |
|-------|------|--------|
| FASE 2 (denne loggen) | **9999** | PowerShell `(Get-Content …\ContentWorkspace.tsx).Count` etter persist/hook-uttrekk |
| FASE 3 (nå) | **9883** | Samme metode på samme filsti etter list/detail/reorder-uttrekk + duplikatfjerning i skallet |

**Om «9805»:** Verdien **9805** er **ikke** verifisert mot denne repo-tilstanden i loggen. Mulige forklaringer når tall spriker: annen **commit** / arbeidskopi, **annet verktøy** (`wc -l` vs. `(Get-Content).Count` — siste linje uten `\n` kan telle ulikt), eller **manuell avrunding/feil**. **Bevisbar sannhet** for denne runden er **9999 → 9883** med samme målemetode.

**Netto i `ContentWorkspace.tsx`:** **−116 linjer** (9999 → 9883). Dette er en målbar reduksjon; ikke en påstand uten tall.

### B) Hva som ble flyttet ut (ansvar)

| Tidligere i skallet | Nytt hjem |
|---------------------|-----------|
| Sidebar-liste state, `GET /api/backoffice/content/pages`, forside-POST, sortering, `listReloadKey` | `useContentWorkspaceData.ts` |
| `GET` side-detalj, `cmsPageDetailQueryString()`, parse envelope, kall til hydrering | Samme hook (`loadPage`); hydrering via ref |
| `detailLoading` / `detailError` / `pageNotFound` / `refetchDetailKey` | Eiet av hook; eksportert til skall |
| Kontrakt for «etter parse → sett editor state» | `contentWorkspaceDetailLoadRef.ts` (`clearWorkspaceWhenNoPage`, `onBeforeDetailFetch`, `applyLoadedPage`, `applyNotFound`, `applyLoadError`) |
| DnD `onDragEnd` + `arrayMove` for blokker | `contentWorkspace.blockReorder.ts` → `useBlockListDragEndHandler` |

**Skall:** `ContentWorkspace.tsx` definerer fortsatt `detailLoadRef`-callbacks (`applyParsedBody`, outbox, snapshot, osv.) og kobler `useContentWorkspaceData({ detailLoadRef })` — men **fetch-sekvens og liste-state** ligger ikke lenger som to store `useEffect` i monolitten.

### C) Nye filer (linjetall, PowerShell)

| Fil | Linjer |
|-----|--------|
| `useContentWorkspaceData.ts` | 250 |
| `contentWorkspaceDetailLoadRef.ts` | 28 |
| `contentWorkspace.blockReorder.ts` | 34 |

### D) `git diff --stat` (begrensning)

Nye filer kan mangle i `git diff --stat` mot `HEAD` til de er **tracket/committet**. Mot `HEAD` for kun `ContentWorkspace.tsx` har arbeidskopien typisk stor diff (innsetting/sletting i samme fil). **Stat mot index** for denne runden: se `git diff HEAD -- app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` lokalt etter commit.

### E) Kommandoer (verifisert etter TS-rettelse i `useContentWorkspaceData`)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` (~12 min `next build` + SEO-skript); **heap-heving er fortsatt mitigering**, ikke bevis på full robusthet uten ekstra minne |

### F) Preview (presisering vs. FASE 2)

FASE 2 sa «uendret bevisst»; **FASE 3** flytter detaljene til `POST_IMPLEMENTATION_REVIEW.md` (felles `normalizeBlockForRender` → `renderBlock`, `deriveBodyForSave` → `buildDraftSavePayload`, og hva som skjer etter vellykket `performSave`).

---

## 2026-03-26 — FASE 4: `useContentWorkspaceBlocks` faktisk koblet inn + `contentWorkspace.blockRegistry` (felt-hint)

### 1) Linjetall `ContentWorkspace.tsx` (metode: PowerShell `(Get-Content …\ContentWorkspace.tsx).Count`)

| Milepæl | Linjer | Merknad |
|---------|--------|---------|
| FASE 2 (logget i denne filen) | 9999 | Etter persist/hook for save/status |
| FASE 3 (logget) | 9883 | Etter list/detail + reorder-uttrekk |
| **Etter FASE 4 (målt i denne økten)** | **9841** | Etter innkobling av `useContentWorkspaceBlocks` + fjerning av duplikat blokk-state/`bodyForSave`-`useMemo`/`applyParsedBody` i skallet |

**Δ FASE 3 → FASE 4:** 9883 − 9841 = **42** færre linjer i `ContentWorkspace.tsx` (samme målemetode).

### 2) Avklaring 9805 / 9999 / `git show HEAD`

- **9999** og **9883** er begge logget her med samme PowerShell-telling på arbeidskopi etter respektive faser.
- Tallet **9805** er **ikke** knyttet til en verifisert commit i denne loggen (mulig annen måling, annen branch, eller feil).
- `git show HEAD:"app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx" | Measure-Object -Line` på gjeldende branch ga **8309** linjer — **ulikt** 9883/9841 fordi **HEAD-commit** på branchen ikke nødvendigvis samsvarer med arbeidskopi brukt i CMS-refaktorøkter. For sammenligning: bruk **samme filtilstand** (commit eller working tree) og **samme målekommando**.

### 3) `git diff --stat` (eksempel fra verifisering; arbeidskopi vs `HEAD`)

```
ContentWorkspace.tsx       | 6349 ++++++++++++--------
useContentWorkspaceBlocks.ts | 43 +-
```

(Nye filer som `contentWorkspace.blockRegistry.ts` vises ikke i `git diff --stat` mot `HEAD` før de er **git add** / committet.)

### 4) Ansvar flyttet ut (strukturell endring, ikke «flytt helpers»)

| Tidligere duplisert i `ContentWorkspace.tsx` | Eier nå |
|---------------------------------------------|---------|
| `useState` for `bodyMode`, `blocks`, `meta`, `legacyBodyText`, `invalidBodyRaw`, `bodyParseError`, `expandedBlockId` | `useContentWorkspaceBlocks.ts` |
| `bodyForSave` (`useMemo` med `deriveBodyForSave` + envelope) | Samme hook |
| `applyParsedBody` | Samme hook |
| `setBlockById`, `onAddBlock` (+ `onAfterAddBlock` for modal/animasjon), `onMoveBlock`, `onToggleBlock`; `onDeleteBlock` med `selectedBlockId` sync | Hook + tynn `onDeleteBlock`-wrapper i skallet |
| Ad hoc `getBlockFieldSchema` + `validateEditorField`-løkke for `visualPreviewFieldHints` | `contentWorkspace.blockRegistry.ts` → `workspaceFieldHintsForBlock` |

### 5) Filstørrelser (PowerShell, etter FASE 4)

| Fil | Linjer |
|-----|--------|
| `useContentWorkspaceBlocks.ts` | 139 |
| `contentWorkspace.blockRegistry.ts` | 19 |

### 6) Kommandoer (verifisert etter FASE 4)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende + nye exhaustive-deps-varsel i `ContentWorkspace.tsx` rundt hook-settere) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` (~9,5 min inkl. `next build` + SEO-skript) |

### 7) Build / Node-minne

- **Tung fase:** `next build` (TypeScript + kompilering + applikasjonsomfang) — samme som tidligere.
- **Elevated heap** er fortsatt **påkrevd** i denne økten for full `build:enterprise` — **ikke** dokumentert som «løst» uten OOM uten `NODE_OPTIONS`.

---

## Gjenværende dataflow-ansvar i `ContentWorkspace.tsx` før FASE 5 (verifisert)

Dette dokumenterer **ikke** at hovedmålet var oppnådd før denne runden — bare hva som **faktisk** fortsatt lå i skallet:

| Område | Hva som fortsatt var i skallet |
|--------|--------------------------------|
| Liste/detalj **fetch** | `GET`-`useEffect`-kall lå allerede i `useContentWorkspaceData.ts`, men **ikke** full «/workspace dataflow»-eierskap: skallet bygde fortsatt hele `detailLoadRef` med `clearWorkspaceWhenNoPage`, `applyLoadedPage`, outbox-rekon, osv. |
| **Editor sync etter detalj** | Implementasjon av `applyLoadedPage` / `clearWorkspaceWhenNoPage` / `onBeforeDetailFetch` / `applyNotFound` / `applyLoadError` lå i `ContentWorkspace.tsx` (ca. 120+ linjer sekvensering + state-settere). |
| **Aktiv side / navigasjon** | `guardedPush`, `onSelectPage`, `onReloadFromServer`, `pendingNavigationHref` (delvis) — logikk for dirty-guard og refetch lå i skallet. |
| **Sekvens ved rute-endring** | To `useEffect` for URL-blokkfokus + én for å nullstille `historyVersionPreview` ved `selectedId`-endring lå i skallet (sideeffekter koblet til valgt side). |
| **Kilde for `selectedId`** | Prop `initialPageId` fra rute (`ContentWorkspace` er fortsatt konsument av Next-data); **dataflyt-laget** styrer nå navigasjon og detalj→editor, ikke kilde-URL. |

---

## Gjenværende UI-/inspektøransvar i `ContentWorkspace` før FASE 6 (kartlagt)

| Område | Hva som lå i skallet |
|--------|----------------------|
| **Blokkvalg / fokus** | `selectedBlockId`, `hoverBlockId`; `onSelectBlockFromTree` (expand + scroll); `onDeleteBlock` som nullstiller valg; duplikat/pitch/WOW som kaller `setSelectedBlockId` |
| **Preview- og layout-kontroll** | `showPreviewColumn`, `previewLayoutMode`, `canvasMode`, `previewDevice`; avledet `showPreview` / `showBlocks` |
| **Legacy side-faner** | `legacyPageTab` (innhold / ekstra / …) |
| **Inspector-derivater** | `useMemo`: `selectedBlock`, `selectedBlockForInspector`, `selectedBlockIndex` |
| **Panel-/canvas-sideeffekter** | `useEffect`: scroll/focus til `lp-editor-block-${selectedBlockId}`; `useEffect`: scroll til topp når `canvasMode === "preview"` |
| **WOW display** | `displayBlocks` vs. duplikat `displayBlocksForCopilot` (samme formel) |
| **Fortsatt tungt i skallet etter kartlegging** | `mainView` / `globalSubView` / `globalPanelTab`, design/header/footer/navigasjon-tabs, `blockInspectorCtx`-factory (koblet til AI/rich text), alle AI-/growth-/modal-states, `mediaPicker*`, `addBlockModalOpen`, layout-tree slot `useEffect`, m.m. |

---

## 2026-03-27 — FASE 6: `useContentWorkspaceUi.ts` (inspector / panel / layout-orkestrering)

### 1) Linjetall `ContentWorkspace.tsx` (PowerShell `(Get-Content …).Count`)

| Milepæl | Linjer |
|---------|--------|
| Før FASE 6 (målt før uttrekk) | **9228** |
| **Etter FASE 6 (målt)** | **9198** |

**Δ:** 9228 − 9198 = **30** færre linjer i `ContentWorkspace.tsx` (samme målemetode).

### 2) Modul

| Fil | Linjer (ca.) |
|-----|----------------|
| `useContentWorkspaceUi.ts` | **~114** |

### 3) Konkret flyttet ut av skallet

**`useState` (8):** `selectedBlockId`, `hoverBlockId`, `showPreviewColumn`, `previewLayoutMode`, `canvasMode`, `previewDevice`, `legacyPageTab` (+ flyttet `originalBlocks` / `showAfter` **opp** før `useContentWorkspaceBlocks` for å kunne bygge `displayBlocks` før `useContentWorkspaceData`).

**`useMemo` (5):** `displayBlocks` (WOW — i skallet, én kilde), `selectedBlock`, `selectedBlockForInspector`, `selectedBlockIndex`; `showBlocks` / `showPreview` avledet i hook.

**`useCallback` (2):** `onSelectBlockFromTree`, `onDeleteBlock`.

**`useEffect` (2):** scroll/focus ved endret `selectedBlockId`; scroll til topp ved `canvasMode === "preview"`.

**Fjernet fra skallet:** duplikat `displayBlocksForCopilot` (erstattet med `displayBlocks` overalt).

### 4) Hva skallet **fortsatt** gjør

- **Faner og hovedvisning:** `mainView`, `globalSubView`, `globalPanelTab`, `contentSettingsTab`, `navigationTab`, `designTab`, `footerTab`, m.m.
- **Inspector-innhold:** `blockInspectorCtx` (settere + AI-kall), `BlockInspectorFields`-render.
- **AI / modaler / media:** uendret eierskap i skallet.
- **Dataflyt:** `useContentWorkspaceData` uendret i denne runden; `routeUi` konsumerer `setSelectedBlockId` fra `useContentWorkspaceUi`.

### 5) Kommandoer (FASE 6)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

---

## Gjenværende global workspace-orkestrering i ContentWorkspace før FASE 7 (kartlagt)

| Område | Hva som lå i skallet |
|--------|----------------------|
| **`mainView` / `globalSubView` / `globalPanelTab`** | Tre `useState` + `setMainView`/`setGlobalSubView` spredt i sidebar, hovedinnhold og global-kort; ingen sentral «reset» ved bytte av hovedvisning |
| **Global workspace-navigasjon (JSX)** | Stor inline-blokk: **Global / Design / Recycle Bin**-knapper i venstresidebar |
| **`blockInspectorCtx`** | `useMemo` med full objekt-literal i skallet (alle felt til `BlockInspectorFields`) |
| **Underfaner globalt** | `contentSettingsTab`, `navigationTab`, `designTab`, `footerTab`, header-variant, m.m. — fortsatt i skallet |
| **AI / growth / modaler** | Stor andel state og `useCallback` for workspace-spesifikk AI-orkestrering |

---

## 2026-03-27 — FASE 7: `useContentWorkspaceShell.ts` + `contentWorkspace.inspector.ts` + `ContentWorkspaceViewModeChips.tsx`

### 1) Linjetall `ContentWorkspace.tsx` (PowerShell `(Get-Content …).Count`)

| Milepæl | Linjer |
|---------|--------|
| Før FASE 7 (etter FASE 6) | **9198** |
| **Etter FASE 7 (målt)** | **9105** |

**Δ:** 9198 − 9105 = **93** færre linjer i `ContentWorkspace.tsx`.

### 2) Nye moduler

| Fil | Rolle |
|-----|--------|
| `useContentWorkspaceShell.ts` | `mainView`, `globalPanelTab`, `globalSubView`, `useEffect` som nullstiller `globalSubView` når `mainView !== "global"`, callbacks `goToGlobalWorkspace`, `goToDesignWorkspace`, `openGlobalSubViewCard`, `exitGlobalSubView` |
| `contentWorkspace.inspector.ts` | `buildBlockInspectorFieldsCtx` — kanonisk oppsett av `BlockInspectorFieldsCtx` (samme felt som `BlockInspectorFields`-typen) |
| `ContentWorkspaceViewModeChips.tsx` | Ekstrahert komposisjon: Global / Design / Recycle Bin-rad i sidebar |

### 3) Konkret flyttet ut av skallet

- **State:** `mainView`, `globalPanelTab`, `globalSubView` (fra skallet til `useContentWorkspaceShell`).
- **Effect:** ved forlatelse av Global-hovedvisning nullstilles `globalSubView` (unngår «hengende» underdrill).
- **Callbacks:** `goToGlobalWorkspace`, `goToDesignWorkspace`, `openGlobalSubViewCard`, `exitGlobalSubView` (erstatter inline `setGlobalSubView(null)` og kort-if-kjede).
- **Inspector:** `blockInspectorCtx` bygges via `buildBlockInspectorFieldsCtx` — skallet mater fortsatt `useMemo` med avhengigheter, men **objekt-oppskriften** ligger i `contentWorkspace.inspector.ts`.
- **JSX:** `ContentWorkspaceViewModeChips` reduserer monolitten uten å endre preview/dataflyt.

### 4) Kommandoer (FASE 7)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` (verifiser lokalt) |

### 5) Hva skallet **fortsatt** gjør

- **Faner under global/design** (`contentSettingsTab`, `navigationTab`, `designTab`, …), **header/footer-editor**, **AI**-state, **modaler**.
- **`useMemo`** som kaller `buildBlockInspectorFieldsCtx` (avhengigheter fortsatt i skallet).

---

## 2026-03-27 — FASE 5: Workspace dataflyt inn i `useContentWorkspaceData.ts`

### 1) Linjetall `ContentWorkspace.tsx` (PowerShell `(Get-Content …).Count`)

| Milepæl | Linjer |
|---------|--------|
| Etter FASE 4 (logget) | **9841** |
| **Etter FASE 5 (målt)** | **9669** |

**Δ:** 9841 − 9669 = **172** færre linjer i `ContentWorkspace.tsx` (samme målemetode).

### 2) `useContentWorkspaceData.ts` (dataflyt-modul)

| Fil | Linjer (etter FASE 5, ca.) |
|-----|----------------------------|
| `useContentWorkspaceData.ts` | **~474** |

### 3) Konkret flyttet ut av skallet (navn)

**`useEffect` (tidligere i `ContentWorkspace.tsx`, nå i `useContentWorkspaceData.ts`):**

1. «Nullstill fokus-flagg når `selectedId` / `initialFocusBlockId` endres» (tidligere `focusFromUrlAppliedRef`).
2. «Når blokker er klare: bruk `focusBlock` fra URL + scroll» (tidligere URL-blokkfokus-effekt).
3. «Når `selectedId` endres: nullstill historikk-forhåndsvisning» (tidligere `setHistoryVersionPreview(null)`).

**Callbacks / navigasjon (tidligere i skallet, nå i `useContentWorkspaceData.ts`):**

- `guardPush` (dirty → pending href, ellers `router.push` + `clearAutosaveTimer`).
- `selectContentPage` (sett `mainView`, unngå samme side, push til `/backoffice/content/[id]`).
- `reloadDetailFromServer` (offline-sjekk, `clearAutosaveTimer`, `setRefetchDetailKey`).

**Detalj → editor sync (sekvens flyttet ut av skallet):**

- `assignDetailLoadRef` + `ContentWorkspaceEditorSyncInput`: `clearWorkspaceWhenNoPage`, `onBeforeDetailFetch`, `applyNotFound`, `applyLoadError`, `applyLoadedPage` (inkl. `makeSnapshot`, outbox/`fingerprintOutboxDraft`, `applyParsedBody`-rekkefølge) — **implementert i `useContentWorkspaceData.ts`**; skallet sender bare settere via `editorSync`-objektet.

### 4) Liste → detalj → editor (sekvens eid av hook)

1. List `useEffect`: `GET /api/backoffice/content/pages` → `setItems` (uendret plassering, nå del av samme modul som resten).
2. Detail `useEffect`: `GET /api/backoffice/content/pages/[id]?…` → `parseBodyEnvelope` → `parseBodyToBlocks` → `setPage(next)` → `detailLoadRef.current.applyLoadedPage({…})` som kaller `editorSync`-settere i **fast rekkefølge** (dokumentType, tittel, slug, `applyParsedBody`, snapshot, outbox).
3. **`detailRunIdRef`:** ved tom `selectedId` økes run-id slik at sen ankommende detalj-svar **ikke** overskriver nullstilling — **kun** i **`useContentWorkspaceData.ts`**; `useContentWorkspacePageData.ts` er **fjernet** (én hook, ingen parallell sannhet).

### 5) Blokk + dataflow (minimal, som forlangt)

- **URL-fokus på blokk** etter sidebytte: eies av `useContentWorkspaceData` via `routeUi` (`blocks`, `setSelectedBlockId`, `setExpandedBlockId`, `initialFocusBlockId`) — kobling mellom **valgt side** og **editor-fokus**, ikke ny blokk-refaktor.

### 6) `git diff --stat` (arbeidskopi vs `HEAD`, denne runden)

Konsolidering (typisk sett filer): `ContentWorkspaceState.ts` (+ `PageLoadedData` / `PageErrorPayload`), `ContentWorkspaceLoader.ts`, `useContentWorkspaceWorkflow.ts`, `useContentWorkspaceData.ts`, `tests/cms/contentWorkspaceStability.smoke.test.ts`, slettet `useContentWorkspacePageData.ts`. Kjør lokalt:

`git diff --stat HEAD --` på disse stiene for nøyaktig diff når endringene er staged.

### 7) Kommandoer (FASE 5)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

### 8) Hva skallet **fortsatt** gjør (ærlig)

- **UI / layout / AI / paneler / WOW** — dominerende linjeantall.
- **Kompilerer `editorSync` og `navigation` objekter** (settere + `router` + `dirty`); **implementasjonen** av detalj-sync og navigasjonsbeslutning ligger nå i `useContentWorkspaceData.ts`, ikke i skallet.

---

## Gjenværende AI-/modal-/subview-ansvar i ContentWorkspace før FASE 8 (kartlagt)

Verifisert i `ContentWorkspace.tsx` **før** uttrekk av `useContentWorkspaceOverlays.ts` (arbeidskopi før endring):

| Område | Hva som lå i skallet |
|--------|----------------------|
| **Globale underfaner (innhold/nav/design/footer)** | `contentSettingsTab`, `navigationTab`, `footerTab`, `designTab` + `set*` — ren workspace-visningsorkestrering for globale paneler |
| **Copilot** | `copilotDismissedIds`, `copilotSuggestions`, `copilotBusy`, `copilotError`, debounced fetch mot `/api/ai/copilot`, `onCopilotApply` / `onCopilotDismiss`, `visibleCopilotSuggestions` |
| **Design-AI-panel** | `designScore`, `designIssues`, design-preview state, `onDesignAnalyze` / `onDesignImprove` / `onDesignApplyPreview` / `onDesignDiscardPreview`, `controlTowerEnabled` |
| **Growth-AI-panel** | `growthProductInput`, SEO/ads/funnel state og `onGrowthRun*` callbacks |
| **Autonomy/dashboard-panel** | `autonomy*` state og `onAutonomyRefreshDashboard` / `onAutonomyPreviewAutomation` / `onAutonomyApproveExecute` |
| **Editor CMS-meny-utkast** | `editorCmsMenuDraft` (AI-panel) |
| **Full-page AI-modal** | `aiFullPageModal*`, `aiFullPagePreview`, `closeAiFullPageModal`, `onAiFullPageModalGenerate` / `Apply`, `aiFullPagePreviewBlocks` |
| **Ugyldig body — bekreftelse** | `invalidBodyResetConfirmOpen` + åpne/lukke koblet til `bodyMode` |
| **Blokkvelger-overlay** | `blockPickerOpen`, `addInsertIndexRef` |
| **AI-capability + editor_opened** | `aiCapability`, `editorOpenedLoggedForRef` + `useEffect` mot `/api/backoffice/ai/capability` og `logEditorAiEvent` |
| **JSX** | Stor inline-blokk for full-page AI-dialog + `BlockPickerOverlay` rett under |
| **Hjelpefunksjoner** | `isCopilotBlockForFetch`, `copilotFingerprintBlocks`, `mapSerializedAiBlockToBlock`, `summarizeBlocksForAiPrompt` (spredt ved modal/append) |

**Ikke mål i denne runden:** `callAiSuggest` / `callDedicatedAiRoute` / rik tekst inline-AI — fortsatt i skallet (egen lag, tett koblet til `blockInspectorCtx`).

---

## 2026-03-27 — FASE 8: `useContentWorkspaceOverlays.ts` + `ContentWorkspaceAiFullPageModal.tsx` + delte AI-serialiseringshjelpere

### 1) Linjetall `ContentWorkspace.tsx` (PowerShell `(Get-Content …).Count`)

| Milepæl | Linjer |
|---------|--------|
| Før FASE 8 (målt før uttrekk, denne økten) | **9537** |
| **Etter FASE 8 (målt)** | **8741** |

**Δ:** 9537 − 8741 = **796** færre linjer i `ContentWorkspace.tsx` (samme målemetode).

### 2) Nye / utvidede moduler

| Fil | Rolle |
|-----|--------|
| `useContentWorkspaceOverlays.ts` | Eier: globale underfaner (`contentSettingsTab`, `navigationTab`, `footerTab`, `designTab`), copilot-state + fetch, design/growth/autonomy AI-panel state + callbacks, full-page AI-modal state + `onAiFullPageModalGenerate` / `Apply`, `aiFullPagePreviewBlocks`, invalid-body bekreftelsesflagg + `bodyMode`-effect, `blockPickerOpen` / `addInsertIndexRef`, `aiCapability` + editor_opened-metrics, `useEffect` på `effectiveId` som nullstiller overlay-lag |
| `ContentWorkspaceAiFullPageModal.tsx` | Komposisjon av full-page AI-dialog (samme `LivePreviewPanel` som før — ingen ny preview-pipeline) |
| `contentWorkspace.ai.ts` (utvidet) | `summarizeBlocksForAiPrompt`, `mapSerializedAiBlockToBlock` — én kilde for serialisering brukt av overlay-hook og `appendSerializedAiBlocks` i skallet |

### 3) Konkret flyttet ut av skallet (navn)

**State / memos / effects:** `contentSettingsTab`, `navigationTab`, `footerTab`, `designTab`; hele copilot-subsystemet; `editorCmsMenuDraft`; design/growth/autonomy panel-state; `aiFullPageModal*`; `invalidBodyResetConfirmOpen`; `blockPickerOpen` + `addInsertIndexRef`; `aiCapability`; `editor_opened` + capability-fetch effects; `aiFullPagePreviewBlocks` useMemo; `useEffect` på `effectiveId` for overlay-reset; `useEffect` på `bodyMode` for invalid-body dialog.

**Callbacks:** `onCopilotApply` / `onCopilotDismiss`; `onDesignAnalyze` / `onDesignImprove` / `onDesignApplyPreview` / `onDesignDiscardPreview`; `onGrowth*`; `onAutonomy*`; `closeAiFullPageModal`, `onAiFullPageModalGenerate`, `onAiFullPageModalApply`; `requestInvalidBodyResetConfirm`, `closeInvalidBodyResetConfirm`.

**Skall:** `ContentWorkspace.tsx` kaller `useContentWorkspaceOverlays({...})` og rendrer `<ContentWorkspaceAiFullPageModal … />`; `effectiveId`-effect i skallet nullstiller kun **editor**-lag (valgt blokk, rik tekst, CMS AI busy, pending navigasjon, block pulse) — ikke overlay-lag (eid av hook).

### 4) `blockInspectorCtx`

- **Uendret** i denne runden: `buildBlockInspectorFieldsCtx` i `contentWorkspace.inspector.ts`; skallet bygger fortsatt `useMemo` med avhengigheter — ingen ny kobling til overlay-hook.

### 5) Kommandoer (FASE 8)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende + kjente warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

### 6) Hva skallet **fortsatt** gjør (strukturelle rester)

- Stor **`callAiSuggest` / `callDedicatedAiRoute`**-blokk og rik-tekst/inline-AI (koblet til `blockInspectorCtx`).
- **`appendSerializedAiBlocks`** og øvrig CMS multimodal/layout-AI som ikke er «global overlay».
- **WOW / onboarding / page intent** — fortsatt i skallet.

---

## Gjenværende AI-transport og inspector-kobling før FASE 9 (kartlagt)

Verifisert i arbeidskopi **før** FASE 9-uttrekk:

| Lag | Hva som var blandet |
|-----|---------------------|
| **UI-state** | `useContentWorkspaceOverlays.ts` inneholdt både faner/block picker/invalid **og** copilot/design/growth/autonomy/full-page fetch + `aiCapability`-fetch |
| **Request/workflow** | `ContentWorkspace.tsx` hadde inline `callAiSuggest` / `callDedicatedAiRoute` + alle `handleAi*`; rik tekst: `fetchRichTextInlineBody`, continue/rewrite |
| **Inspector** | `blockInspectorCtx` var én stor `useMemo` med alle rich-text + bilde-AI-felter inline |

---

## 2026-03-27 — FASE 9: `useContentWorkspaceAi` wiring + `contentWorkspace.aiRequests.ts` + tynn `useContentWorkspaceOverlays`

### 1) Linjetall (PowerShell `(Get-Content …).Count`)

| Fil | Før (FASE 8) | Etter |
|-----|----------------|-------|
| `ContentWorkspace.tsx` | **8741** | **8271** |
| `useContentWorkspaceOverlays.ts` | **851** | **96** |
| `contentWorkspace.aiRequests.ts` | — | **954** (ny: panel-transport + rich-text-transport) |

### 2) Flyttet ansvar

| Modul | Eier nå |
|-------|---------|
| **`useContentWorkspaceAi.ts`** | `callAiSuggest` / `callDedicatedAiRoute`, editor-AI handlers, `aiCapability`, busy/error/summary, block builder result, m.m. (koblet via `onApplySuggestPatch` + `onMergeDiagnostics` fra skallet) |
| **`contentWorkspace.aiRequests.ts`** | **`useContentWorkspaceRichTextTransport`**: `/api/ai/inline`, `/api/ai/continue`, `/api/ai/rewrite`; **`useContentWorkspacePanelRequests`**: copilot, design/growth/autonomy, full-page AI-modal (`generateAiPageDraftAction`) |
| **`useContentWorkspaceOverlays.ts`** | Kun globale faner, `editorCmsMenuDraft`, invalid-body-bekreftelse, block picker, `editor_opened`-telemetri |

### 3) `blockInspectorCtx`

- **`buildBlockInspectorRichTextSlice`** + type **`BlockInspectorRichTextSlice`** i `contentWorkspace.inspector.ts` — rich-text/bilde-AI-deler grupperes i egen `useMemo` før `buildBlockInspectorFieldsCtx`.

### 4) Preview

- Uendret: samme `parseBodyToBlocks` / `applyParsedBody`-kjede; full-page modal bruker fortsatt `LivePreviewPanel` via `ContentWorkspaceAiFullPageModal`.

### 5) Kommandoer (FASE 9)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

---

## Gjenværende panel-AI-klynger før FASE 10 (kartlagt)

Verifisert i **`useContentWorkspacePanelAi.ts`** umiddelbart før domene-splitting:

| Klynge | Eierskap | State / handlinger | Nullstilling ved `effectiveId` |
|--------|----------|-------------------|-------------------------------|
| **Copilot** | `/api/ai/copilot`, debounce, fokus-blokk | `copilotBusy`, `copilotError`, `copilotSuggestions`, `visibleCopilotSuggestions`, `onCopilotApply` / `onCopilotDismiss`, `copilotDismissedIds` (per `selectedBlockId`) | Ikke i felles `effectiveId`-effect (kun suggestions/refresh ved fokus/fingerprint) |
| **Design** | `/api/ai/design/analyze`, `/api/ai/design/generate` | `designScore`, `designIssues`, `designSuggestions`, preview-blokker, `designPanelBusy` / `designPanelError`, `onDesignAnalyze` / `onDesignImprove` / `onDesignApplyPreview` / `onDesignDiscardPreview` | Ja, i felles effect |
| **Growth** | `/api/ai/growth/*` (SEO, ads, funnel) | `growthProductInput`, SEO/annonse/funnel-lister, `growthBusy` / `growthError`, `onGrowthRun*` / `onGrowthClearPreview` | Ja |
| **Autonomy** | `GET /api/ai/dashboard`, `POST /api/ai/automation` | `autonomyMetrics` / `autonomyInsights` / `autonomyDecisionRow`, `autonomyAutomationText`, `onAutonomyRefreshDashboard` / preview / execute | Ja |
| **Full-page AI** | `generateAiPageDraftAction` (strict preview) | Modal open/prompt/busy/error/preview, `aiFullPageReplaceOk`, `onAiFullPageModalGenerate` / `Apply`, `closeAiFullPageModal` | Ja (modal + preview felter) |

**Modal-kobling:** `ContentWorkspace.tsx` rendrer `<ContentWorkspaceAiFullPageModal … />` med props fra panel-hook — **ikke** overlay-hook (kun UI-state for faner/picker i `useContentWorkspaceOverlays`).

---

## 2026-03-27 — FASE 10: panel-AI domener (copilot / growth / page-draft)

### 1) Moduler

| Fil | Ansvar |
|-----|--------|
| `contentWorkspace.panelAi.types.ts` | Én `UseContentWorkspacePanelRequestsParams` (kontrakt for kompositor + underhooks) |
| `useContentWorkspaceCopilot.ts` | Copilot-rail: fetch, debounce, apply/dismiss, loading/error |
| `useContentWorkspaceGrowthAi.ts` | Design + growth + autonomy (høyre-rail «surfaces»), egne loading/error/apply |
| `useContentWorkspacePageDraftAi.ts` | Full-page AI-utkast, preview, apply, modal-state (workflow — ikke overlay-chrome) |
| `useContentWorkspacePanelAi.ts` | Tynn kompositor: `useContentWorkspacePanelRequests` = `{ ...copilot, ...growth, ...pageDraft }` |

### 2) Uendret

- `contentWorkspace.aiRequests.ts` — kun transport
- `useContentWorkspaceOverlays.ts` — kun UI-state
- `ContentWorkspace.tsx` — ingen ny AI-logikk; fortsatt `useContentWorkspacePanelRequests({...})` + destructuring
- `blockInspectorCtx` — ingen endring (panel-AI ligger utenfor inspector-kontrakten)

### 3) Linjetall `(Get-Content …).Count` (FASE 10)

| Fil | Før (én `useContentWorkspacePanelAi` + skall) | Etter |
|-----|-----------------------------------------------|--------|
| `ContentWorkspace.tsx` | **8309** (`git show HEAD`) | **8263** (uendret API mot panel) |
| `useContentWorkspacePanelAi.ts` | **737** (monolitt, siste FASE 9-tilstand) | **59** (kompositor) |
| `useContentWorkspaceCopilot.ts` | — | **174** |
| `useContentWorkspaceGrowthAi.ts` | — | **486** (design + growth + autonomy) |
| `useContentWorkspacePageDraftAi.ts` | — | **128** |
| `contentWorkspace.panelAi.types.ts` | — | **27** |

### 4) Kommandoer (FASE 10)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

---

## Gjenværende design/growth/autonomy-klynger før FASE 11 (kartlagt)

Verifisert i **`useContentWorkspaceGrowthAi.ts`** umiddelbart før split:

| Del | API / atferd | State | `effectiveId`-reset |
|-----|--------------|-------|---------------------|
| **Design** | `POST /api/ai/design/analyze`, `POST /api/ai/design/generate` | score, issues, suggestions, preview-blokker, busy/error, apply (WOW/originalBlocks) / discard | Tidligere én effect sammen med growth/autonomy |
| **Growth** | `POST /api/ai/growth/seo`, `ads`, `funnel` | produkt/audience-input, SEO/ads/funnel-lister, `growthBusy` / `growthError` | Samme effect |
| **Autonomy** | `GET /api/ai/dashboard`, `POST /api/ai/automation` | metrics, insights, decision row, automation-tekst, busy/error | Samme effect |
| **Delt i én fil** | `growthPanelEnabled === designPanelEnabled` | — | Alt nullstilles i samme `useEffect([effectiveId])` |

**Konsekvens før FASE 11:** design-, growth- og autonomy-logikk delte én hook og én nullstilling.

---

## 2026-03-27 — FASE 11: design vs growth/autonomy + inspector-shell adapter

### 1) Moduler

| Fil | Ansvar |
|-----|--------|
| `useContentWorkspaceDesignAi.ts` | Design: analyse/generer, preview, apply/discard, `controlTowerEnabled`, busy/error, egen reset ved `effectiveId` |
| `useContentWorkspaceGrowthAutonomyAi.ts` | Growth + autonomy, busy/error, egen reset ved `effectiveId` |
| `useContentWorkspaceGrowthAi.ts` | **Fjernet** |
| `useContentWorkspacePanelAi.ts` | Kompositor: copilot + design + growthAutonomy + pageDraft |
| `contentWorkspace.inspector.ts` | `buildBlockInspectorWorkspaceCtxFromShell` — flat `richText`-gruppe |

### 2) `blockInspectorCtx`

- Skallet bruker **`buildBlockInspectorWorkspaceCtxFromShell`** (én import, flat `richText`-objekt).

### 3) Linjetall `(Get-Content …).Count` (FASE 11)

| Fil | Før | Etter |
|-----|-----|--------|
| `ContentWorkspace.tsx` | **8263** | **8261** (flat inspector-adapter) |
| `useContentWorkspacePanelAi.ts` | **59** | **68** (fire underhooks) |
| `useContentWorkspaceGrowthAi.ts` | **486** | **fjernet** |
| `useContentWorkspaceDesignAi.ts` | — | **174** |
| `useContentWorkspaceGrowthAutonomyAi.ts` | — | **338** |
| `contentWorkspace.inspector.ts` | **76** | **88** (`buildBlockInspectorWorkspaceCtxFromShell`) |

### 4) Kommandoer (FASE 11)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

---

## Gjenværende panel-/modal-/shell-komposisjon i ContentWorkspace før FASE 12 (kartlagt)

Verifisert i **`ContentWorkspace.tsx`** umiddelbart før shell-uttrekk:

| Område | Hva skallet fortsatt eide |
|--------|---------------------------|
| **Høyre rail (`RightPanel`)** | `aiSlot`, `diagnoseSlot`, `ceoSlot` som stor inline JSX: AI-utkast (`AiPanel`), sidehensikt + seksjonsinnsetting, `EditorAiPanel`, anbefalings-/enterprise-paneler, growth/autonomy, copilot, `ContentAiTools`; diagnose: page insights, design-AI, revenue/control tower, `aiAudit`; CEO: `AiCeoPanel`, `OutboundPanel`, `EditorGtmDashboardPanel` |
| **Egenskaper (legacy)** | Blokk-inspector (`BlockInspectorFields` + `blockInspectorCtx`) pakket i `max-h` scroll-wrapper |
| **Modal-/dialog-stack** | `ContentWorkspaceAiFullPageModal`, `BlockAddModal`, `BlockPickerOverlay`, `BlockEditModal`, `MediaPickerModal` som sekvens nederst i skallet |
| **Callbacks** | Samme handlers som før; ingen ny domene-/transportlogikk — kun videresending til paneler/modaler |

**Konsekvens før FASE 12:** skallet bar ~300+ linjer rail-JSX + ~130 linjer modaler + dupliserte imports for panelkomponenter.

---

## 2026-03-27 — FASE 12: right rail + modal-stack + inspector-kort (shell-reduksjon)

### 1) Nye / oppdaterte moduler

| Fil | Ansvar |
|-----|--------|
| `ContentWorkspaceRightRail.tsx` | `buildContentWorkspaceRightRailSlots(p)` → `{ aiSlot, diagnoseSlot, ceoSlot }` — samme JSX som tidligere inline; `workspaceAi`-signaturer justert mot `useContentWorkspaceAi` |
| `ContentWorkspaceModalStack.tsx` | Samler full-page AI, block add/picker/edit, mediavelger — props fra skallet |
| `ContentWorkspacePropertiesInspectorCard.tsx` | Wrapper for `BlockInspectorFields` i egenskaps-panelet (samme scroll-ramme) |

### 2) `ContentWorkspace.tsx`

- `useMemo` kaller `buildContentWorkspaceRightRailSlots` med grupperte props (shell, blockNav, cmsAi, pageIntent, editorCmsMenu, panelAi, workspaceAi, diagnose).
- `RightPanel` bruker `rightRailSlots.aiSlot` / `.diagnoseSlot` / `.ceoSlot`.
- Nederst: én `<ContentWorkspaceModalStack … />` i stedet for fem separate modalrøtter.
- Egenskaper: `<ContentWorkspacePropertiesInspectorCard … ctx={blockInspectorCtx} />` — `blockInspectorCtx` bygges fortsatt i skallet via `buildBlockInspectorWorkspaceCtxFromShell`; kun **presentasjons**-wrapper flyttet (ingen ny inspector-sannhet).

### 3) Linjetall `(Get-Content … \| Measure-Object -Line).Lines` (FASE 12)

| Fil | Før (FASE 11) | Etter |
|-----|----------------|-------|
| `ContentWorkspace.tsx` | **8261** | **7745** |
| `ContentWorkspaceRightRail.tsx` | — | **518** |
| `ContentWorkspaceModalStack.tsx` | — | **111** |
| `ContentWorkspacePropertiesInspectorCard.tsx` | — | **17** |
| `useContentWorkspaceGrowthAutonomyAi.ts` | uendret denne runden | — |

**Netto:** ~**516 linjer** fjernet fra `ContentWorkspace.tsx`; rail + modaler eies av egne filer.

### 4) Kommandoer (FASE 12)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

---

## Gjenværende properties-/legacy-shell-komposisjon i ContentWorkspace før FASE 13 (kartlagt)

Verifisert i **`ContentWorkspace.tsx`** umiddelbart før uttrekk:

| Område | Hva skallet fortsatt eide |
|--------|---------------------------|
| **`propertiesSlot` (`RightPanel`)** | Faner (Side / Ekstra / Oppsum. / Nav. / SEO / Scripts / Avansert) + hele innholdet: dokumenttype, layout-thumbnails (`LayoutThumbnail`), `ContentWorkspacePropertiesInspectorCard`, slug/node-info, ekstra/oppsummering/navigasjon/SEO (inkl. AI SEO-knapp), scripts head/body, avansert placeholder + side-metadata (`dl`) |
| **`blockInspectorCtx`** | `useMemo` + `buildBlockInspectorWorkspaceCtxFromShell({ richText: { … } })` med lang avhengighetsliste inline i skallet |
| **Hjelpekomponenter** | `LayoutThumbnail` definert lokalt i `ContentWorkspace.tsx` kun for egenskaps-layout |

**Konsekvens før FASE 13:** ~690+ linjer legacy-egenskaps-JSX + inspector-`useMemo` i én fil.

---

## 2026-03-27 — FASE 13: `ContentWorkspacePropertiesRail` + `useBlockInspectorWorkspaceCtxFromShell`

### 1) Nye moduler

| Fil | Ansvar |
|-----|--------|
| `ContentWorkspacePropertiesRail.tsx` | Legacy egenskaps-rail: faner + alle underfaner (innhold → avansert); `LayoutThumbnail` flyttet hit; `safeStr`/`safeObj`/`formatDate` fra `contentWorkspace.helpers` |
| `contentWorkspace.inspectorCtx.ts` | `useBlockInspectorWorkspaceCtxFromShell` — `useMemo`+deps for inspector flyttet ut av `ContentWorkspace.tsx` (samme granularitet som før) |

### 2) `ContentWorkspace.tsx`

- `propertiesSlot={<ContentWorkspacePropertiesRail … />}` med eksplisitte props (ingen ny forretningslogikk).
- `blockInspectorCtx` settes med `useBlockInspectorWorkspaceCtxFromShell({ … })` i stedet for lang inline `useMemo`.
- `LayoutThumbnail` fjernet fra skallet.

### 3) Linjetall `(Get-Content … \| Measure-Object -Line).Lines` (FASE 13)

| Fil | Før (FASE 12) | Etter |
|-----|----------------|-------|
| `ContentWorkspace.tsx` | **7745** | **7039** |
| `ContentWorkspacePropertiesRail.tsx` | — | **771** |
| `contentWorkspace.inspectorCtx.ts` | — | **61** |

**Netto:** ~**706 linjer** fjernet fra `ContentWorkspace.tsx`.

### 4) Kommandoer (FASE 13)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

---

## Gjenværende hovedkolonne-/canvas-shell-komposisjon i ContentWorkspace før FASE 14 (kartlagt)

Verifisert i **`ContentWorkspace.tsx`** umiddelbart før uttrekk:

| Område | Hva skallet eide |
|--------|------------------|
| **`EditorCanvas` children** | `AnimatePresence` med enten **`PreviewCanvas`** (full canvas preview, `historyPreviewBlocks` / `displayBlocks`) eller editor-gren med grid (`showPreview` × `previewLayoutMode`), «Main content»-seksjon, legacy/invalid body-bannere, **`PageContainer`** + **`EditorSmartHintsBanner`**, tom blokkflate / forside-repo-knapp, **`DndContext` / `SortableContext`** med **`SortableBlockWrapper`**, **`BlockCard`**, **`BlockToolbar`**, **`BlockPreview`**, inline rich-text AI / bilde-loading |
| **Live preview-kolonne** | **`LivePreviewPanel`** med `blocksForLivePreview`, historikk-banner (`historyVersionPreview`), `visualInlineEditApi` |
| **Legacy/invalid aside** | Placeholder når `bodyMode` er `legacy` eller `invalid` |
| **Wiring** | `sensors` + `onDragEndReorder`, `blockInspectorCtx` inn i **`BlockInspectorFields`** på kort (samme ctx som høyre panel); ingen egen preview-transform i skallet utover eksisterende `useMemo` for `blocksForLivePreview` / `visualInlineEditApi` |

**Konsekvens før FASE 14:** ~465+ linjer JSX som bundet canvas, blokkliste, preview og toolbars — fortsatt inline i skallet.

---

## 2026-03-27 — FASE 14: `ContentWorkspaceMainCanvas` (hovedkolonne / editor-canvas / blokkflate / preview-binding)

### 1) Ny modul

| Fil | Ansvar |
|-----|--------|
| `ContentWorkspaceMainCanvas.tsx` | Shell-komposisjon: `AnimatePresence` + `PreviewCanvas` vs. editor-layout; blokkflate med DnD; `LivePreviewPanel`; legacy/invalid aside. Tar imot ferdige props fra `ContentWorkspace` — **ingen** ny domene-, transport- eller preview-pipeline-logikk. |

### 2) `ContentWorkspace.tsx`

- `EditorCanvas` omslutter nå **kun** `<ContentWorkspaceMainCanvas … />` med eksplisitt prop-liste (samme state/handlers som før).
- Duplikat **`blockTypeSubtitle`** fjernet; kanonisk **`blockTypeSubtitle`** importeres i **`ContentWorkspaceMainCanvas`** fra **`contentWorkspace.blocks.ts`**.
- **`blockInspectorCtx`:** fortsatt bygget med **`useBlockInspectorWorkspaceCtxFromShell`** i skallet — **ingen** ytterligere reduksjon av inspector-wiring i denne runden (kun flyttet JSX som mottar samme `ctx`).

### 3) Linjetall `(Get-Content …).Count` (FASE 14)

| Fil | Før (FASE 13, logg) | Etter FASE 14 |
|-----|---------------------|---------------|
| `ContentWorkspace.tsx` | **7039** | **6944** |
| `ContentWorkspaceMainCanvas.tsx` | — | **619** |

**Merk:** Arbeidskopie kan avvike fra FASE 13-tall dersom andre endringer finnes på samme fil; netto er at **hovedkolonne-/canvas-JSX** er flyttet til egen seksjonsfil med reell reduksjon i skallet.

### 4) Kommandoer (FASE 14)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

---

## Gjenværende workspace-krom-/layout-shell-komposisjon i ContentWorkspace før FASE 15 (kartlagt)

Verifisert i **`ContentWorkspace.tsx`** umiddelbart før uttrekk:

| Område | Hva skallet eide |
|--------|------------------|
| **Ytre layout** | `grid` / `flex` for legacy sidebar + `section` for hovedflate (uendret denne runden) |
| **Command center** | **`ContentTopbar`**, outbox recovery-banner, sidetittel-felt, rediger/forhåndsvisning + enhetsvalg + statusrader |
| **Tri-pane** | `grid` med **`LeftSidebar`** (struktur + AI-kontekst), **`EditorCanvas`** + **`ContentWorkspaceMainCanvas`**, **`RightPanel`** / **`ContentWorkspacePropertiesRail`** + høyrerail-slots |
| **Under editor** | **`ContentPageVersionHistory`** + **`ContentSaveBar`** |
| **Modal-/overlay** | **`ContentWorkspaceModalStack`** nederst (uendret plassering) |
| **Wiring** | Samme callbacks som før; **`blockInspectorCtx`** fortsatt fra skallet inn i properties/canvas |

**Konsekvens før FASE 15:** ~250+ linjer workspace-krom + ~175 tri-pane JSX + historikk/lagre-rad — fortsatt inline i skallet.

---

## 2026-03-27 — FASE 15: `ContentWorkspaceEditorChrome` + `ContentWorkspaceWorkspaceShell`

### 1) Nye moduler

| Fil | Ansvar |
|-----|--------|
| `ContentWorkspaceEditorChrome.tsx` | **`ContentWorkspaceEditorChrome`**: toppbar, outbox, tittel, canvas-/preview-rad. **`ContentWorkspaceEditorLowerControls`**: `ContentPageVersionHistory` + `ContentSaveBar` (demo vs. ikke-demo). Ingen ny domene-/transportlogikk. |
| `ContentWorkspaceWorkspaceShell.tsx` | Tri-pane `grid` med `leftColumn` / `centerColumn` / `rightColumn` som **ReactNode** (parent sender **`LeftSidebar`**, **`EditorCanvas`+`ContentWorkspaceMainCanvas`**, **`RightPanel`**). |

### 2) `ContentWorkspace.tsx`

- Fjernet direkte imports av **`ContentTopbar`**, **`ContentPageVersionHistory`**, **`ContentSaveBar`** (historikk-typer beholdes fra **`ContentPageVersionHistory`**).
- **`getOutboxUiStatus`** kun brukt i chrome-modulen nå — fjernet fra skallet.
- **`blockInspectorCtx` / inspector:** uendret bygget i skallet; **ingen** ny reduksjon av inspector-wiring (kun flyttet JSX som mottar samme `ctx`).
- Modal-stack: **`ContentWorkspaceModalStack`** fortsatt ett sted nederst i skallet (samme props); **ingen** forretningslogikk flyttet.

### 3) Linjetall `(Get-Content …).Count` (FASE 15)

| Fil | Før (FASE 14, logg) | Etter FASE 15 |
|-----|---------------------|---------------|
| `ContentWorkspace.tsx` | **6944** | **6724** |
| `ContentWorkspaceEditorChrome.tsx` | — | **421** |
| `ContentWorkspaceWorkspaceShell.tsx` | — | **46** |

### 4) Kommandoer (FASE 15)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

---

## FASE 18 baseline for tracked shell input reduction

**Dato:** 2026-03-27 (lokal verifisering).

| Fil | Linjetall (`(Get-Content …).Count` i PowerShell) | Git-status (ved FASE 18-staging) |
|-----|--------------------------------------------------|-----------------------------------|
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | **5808** (før FASE 18 wire-builders + tri-pane mount) | **M** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceChromeProps.ts` | **296** | **M** (evt. uendret i runden) |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceAuxiliaryShellProps.ts` | **220** | **M** (evt. uendret i runden) |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceChrome.tsx` | **188** | **M** (evt. uendret i runden) |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceShellInputContexts.ts` | **671** (før utvidelse med `buildChromeShellWireInput` / `buildAuxiliaryShellWireInput`) | **M** |

**Merk:** Baseline **5808** er målt umiddelbart før innføring av **`buildChromeShellWireInput`** / **`buildAuxiliaryShellWireInput`** og **`ContentWorkspaceTriPaneMount.tsx`**.

---

## Gjenværende shell input-monolitt i ContentWorkspace før FASE 18

Verifisert i **`ContentWorkspace.tsx`** før uttrekk:

- **Stort objekt-literal** inn i **`buildWorkspaceChromeShellPropsFromWire({ frame: chromeShellFrame(...), shared: …, editor: …, main: …, properties: …, tri: … })`** — ~115 linjer nested factory-kall i parent.
- **Flat/lang input** til **`buildContentWorkspaceAuxiliaryShellProps(buildWorkspaceAuxiliaryShellArgs({ identity: …, detail: …, save: …, pageBody: …, aiPitch: … }))`** — ~70 linjer i parent.
- **To skall-komponenter** (`ContentWorkspaceChrome` + `ContentWorkspaceAuxiliaryShell`) i samme fragment uten egen mount-modul.

**Ikke mål:** preview-`useMemo`, `blockInspectorCtx`-hook, save/publish/dataflow.

---

## 2026-03-27 — FASE 18: tri-pane wire-builders + `ContentWorkspaceTriPaneMount`

### Hva som ble flyttet

| Ny/utvidet modul | Innhold |
|------------------|---------|
| **`contentWorkspaceShellInputContexts.ts`** | **`buildChromeShellWireInput`**, **`buildAuxiliaryShellWireInput`** — ren pass-through til eksisterende `chromeShell*` / `auxiliaryShell*`; returnerer `ChromeShellWireInput` / `AuxiliaryShellWireInput` (samme som tidligere nested objekter i parent). |
| **`ContentWorkspaceTriPaneMount.tsx`** | Tynn mount: **`ContentWorkspaceChrome`** + **`ContentWorkspaceAuxiliaryShell`** med `buildWorkspaceChromeShellPropsFromWire` / `buildContentWorkspaceAuxiliaryShellProps(buildWorkspaceAuxiliaryShellArgs(...))` — **ingen** ny forretningslogikk. |

**`ContentWorkspace.tsx`:** Erstatter ~190 linjer nested chrome+auxiliary JSX med **`<ContentWorkspaceTriPaneMount`** + to posisjonelle kall til wire-builders (kompakt flere argumenter per linje, samme modal-builder-stil). Fjernet direkte imports av **`ContentWorkspaceChrome`**, **`ContentWorkspaceAuxiliaryShell`**, **`buildContentWorkspaceAuxiliaryShellProps`**, og de enkeltvise `chromeShell*` / `auxiliaryShell*`-imports som kun brukes i tri-pane-blokken.

**`contentWorkspaceChromeProps.ts`:** **ikke** utvidet i denne runden (forblir props-builder).

**Linjetall etter FASE 18:** `ContentWorkspace.tsx` **5636**; `contentWorkspaceShellInputContexts.ts` **1022**; `ContentWorkspaceTriPaneMount.tsx` **29** (PowerShell `(Get-Content …).Count`).

### Kommandoer (FASE 18, verifisert i samme runde)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

---

## FASE 19 baseline for tracked shell input modularization

**Dato:** 2026-03-27 (lokal verifisering).

| Fil | Linjetall (`(Get-Content …).Count`) | Git-status (ved FASE 19-staging) |
|-----|--------------------------------------|-----------------------------------|
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | **5636** (før FASE 19 split; etter split **5622**) | **M** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceShellInputContexts.ts` | **1022** (før split; etter **7** — barrel) | **M** |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceTriPaneMount.tsx` | **29** (før; etter **20**) | **M** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceChromeProps.ts` | **296** | uendret i runden |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceAuxiliaryShellProps.ts` | **220** | uendret i runden |

**Nye filer i FASE 19:** `contentWorkspaceChromeShellInput.ts`, `contentWorkspaceAuxiliaryShellInput.ts`, `contentWorkspaceTriPaneMountProps.ts`.

---

## Gjenværende shell input-monolitt etter FASE 18, før FASE 19

Verifisert i **`contentWorkspaceShellInputContexts.ts`** (~1022 linjer):

- **Chrome:** typer (`ChromeShellFrame` … `ChromeShellTri`), **`mergeChromeShellInput`**, **`chromeShell*`-fabrikker**, **`ChromeShellWireInput`**, **`buildWorkspaceChromeShellPropsFromWire`**.
- **Auxiliary:** typer (`AuxiliaryShell*` …), **`mergeAuxiliaryShellInput`**, **`auxiliaryShell*`-fabrikker**, **`AuxiliaryShellWireInput`**, **`buildWorkspaceAuxiliaryShellArgs`**.
- **FASE 18-ekstra:** **`buildChromeShellWireInput`** / **`buildAuxiliaryShellWireInput`** (lange posisjonelle signaturer) — samme pass-through som nested objekt, men samlet i én fil.
- **`ContentWorkspaceTriPaneMount.tsx`:** avhengig av **`ChromeShellWireInput` / `AuxiliaryShellWireInput`** + to builders; ingen egen typed props-fil.

**Mål FASE 19:** splitte chrome vs auxiliary til egne moduler; fjerne posisjonelle mega-buildere; tynn barrel; objektformet **`chromeWire` / `auxiliaryWire`** i parent uten å øke parent-linjetall.

---

## 2026-03-27 — FASE 19: `contentWorkspaceChromeShellInput` + `contentWorkspaceAuxiliaryShellInput` + barrel

### Hva som ble flyttet

| Modul | Ansvar |
|-------|--------|
| **`contentWorkspaceChromeShellInput.ts`** | Chrome-typer, **`mergeChromeShellInput`**, **`chromeShell*`**, **`ChromeShellWireInput`**, **`buildWorkspaceChromeShellPropsFromWire`**. |
| **`contentWorkspaceAuxiliaryShellInput.ts`** | Auxiliary-typer, **`mergeAuxiliaryShellInput`**, **`auxiliaryShell*`**, **`AuxiliaryShellWireInput`**, **`buildWorkspaceAuxiliaryShellArgs`**. |
| **`contentWorkspaceShellInputContexts.ts`** | Tynn **barrel** (`export *` fra chrome + auxiliary) for eksisterende import-stier. |
| **`contentWorkspaceTriPaneMountProps.ts`** | **`ContentWorkspaceTriPaneMountProps`** (`chromeWire` / `auxiliaryWire` — typed wire). |
| **`ContentWorkspaceTriPaneMount.tsx`** | Importerer props-type fra **`contentWorkspaceTriPaneMountProps`**; builders fra barrel. |

**Fjernet:** **`buildChromeShellWireInput`**, **`buildAuxiliaryShellWireInput`** (posisjonell orkestrering). **`ContentWorkspace.tsx`** bygger **`chromeWire` / `auxiliaryWire`** som **objektformede** `ChromeShellWireInput` / `AuxiliaryShellWireInput` med eksisterende fabrikker (kompakt én linje per gruppe der mulig).

**Linjetall etter FASE 19:** `ContentWorkspace.tsx` **5622**; `contentWorkspaceShellInputContexts.ts` **7**; `contentWorkspaceChromeShellInput.ts` **418**; `contentWorkspaceAuxiliaryShellInput.ts` **247**; `ContentWorkspaceTriPaneMount.tsx` **20**; `contentWorkspaceTriPaneMountProps.ts` **8**.

### Kommandoer (FASE 19, verifisert i samme runde)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

---

## FASE 21 baseline for tracked ui-action reduction

**Dato:** 2026-03-27 (lokal verifisering).

| Fil | Linjetall (`split(/\r?\n/)` i Node) | Git-status (ved FASE 21-staging) |
|-----|--------------------------------------|-----------------------------------|
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | **5392** (før FASE 21) | **M** |
| `app/(backoffice)/backoffice/content/_components/useContentWorkspacePresentationState.ts` | **120** | uendret i runden |
| `app/(backoffice)/backoffice/content/_components/contentWorkspacePresentationSelectors.ts` | **93** | uendret i runden |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceChromeShellInput.ts` | **419** | uendret i runden |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceAuxiliaryShellInput.ts` | **248** | uendret i runden |

**Nye filer (FASE 21):** `contentWorkspaceActionGroups.ts`, `useContentWorkspaceUiActions.ts`, `contentWorkspaceEditorConstants.ts`.

---

## Gjenværende ui-action-monolitt i ContentWorkspace før FASE 21

Verifisert i **`ContentWorkspace.tsx`** før uttrekk:

- **Høyre-rail:** `useMemo` for `rightRailSlots` med stort nøstet objekt til `buildContentWorkspaceRightRailSlots` (shell, cmsAi, pageIntent, panelAi, workspaceAi, diagnose) — **kun** pass-through av eksisterende verdier/callbacks.
- **Navigasjon / offentlig side:** `onOpenPublicPage`, `cancelPendingNavigation`, `confirmPendingNavigation` som tynne `useCallback`-wrappere.
- **Section-rail:** `useEffect` som setter `setSectionSidebarContent` etter `effectiveId` — ren chrome-/layout-binding.
- **Konstanter:** `IMAGE_PRESETS`, `LUNCHPORTALEN_*`, `DEMO_BLOCKS`, `ONBOARDING_DONE_KEY` og **`logApiRidFromBody`** / **`cloneBlockDeep`** i samme fil som domene-hookene.

**Ikke mål:** `blocksForLivePreview` / `visualInlineEditApi` / `blockInspectorCtx`-kjede, save/publish, `useContentWorkspaceData` / `useContentWorkspaceBlocks`.

---

## 2026-03-27 — FASE 21: `contentWorkspaceActionGroups` + `useContentWorkspaceUiActions` + editor-konstanter

### Hva som ble flyttet

| Modul | Innhold |
|-------|---------|
| **`contentWorkspaceActionGroups.ts`** | `buildRightRailShellInput`, `buildRightRailBlockNavInput`, `buildRightRailCmsAiInput`, `buildRightRailPageIntentInput`, `buildRightRailEditorCmsMenuInput`, `buildRightRailPanelAiInput`, `buildRightRailWorkspaceAiInput`, `buildRightRailDiagnoseInput` — rene grupperinger av props til `buildContentWorkspaceRightRailSlots`. |
| **`useContentWorkspaceUiActions.ts`** | `useContentWorkspaceOpenPublicPage`, `useContentWorkspacePendingNavigationActions`, `useContentWorkspaceSectionRailPlacement` — tynne UI-callbacks / effekt. |
| **`contentWorkspaceEditorConstants.ts`** | `IMAGE_PRESETS`, `LUNCHPORTALEN_STYLE` / `NEGATIVE` / `SEED`, `ONBOARDING_DONE_KEY`, `DEMO_BLOCKS`. |
| **`contentWorkspace.api.ts`** | `logApiRidFromBody` (tidligere toppnivå i `ContentWorkspace.tsx`). |
| **`contentWorkspace.blocks.ts`** | `cloneBlockDeep` (tidligere toppnivå i `ContentWorkspace.tsx`). |
| **`ContentWorkspace.tsx`** | `publishReadiness`/`canReorderBlocks` som enkle uttrykk (tidligere `useMemo` uten ekstra avledning); `rightRailSlots` bruker action-group-builders; fjernet duplikat-effekt for section-rail. |

**`blockInspectorCtx`:** **ikke endret** i denne runden (samme kilde og flyt).

**Linjetall etter FASE 21:** `ContentWorkspace.tsx` **5299**; `contentWorkspaceActionGroups.ts` **268**; `useContentWorkspaceUiActions.ts` **60**; `contentWorkspaceEditorConstants.ts` **64**; `contentWorkspace.api.ts` **71**; `contentWorkspace.blocks.ts` **634**.

### Kommandoer (FASE 21, verifisert i samme runde)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

---

## FASE 22 baseline for tracked right-rail shell reduction

**Dato:** 2026-03-27 (lokal verifisering).

| Fil | Linjetall (`split(/\r?\n/)` i Node) | Git-status (ved FASE 22-staging) |
|-----|--------------------------------------|-----------------------------------|
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | **5299** (før FASE 22) | **M** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceActionGroups.ts` | **268** (slettet i FASE 22; erstattet av `contentWorkspaceRightRailSlots.ts`) | **D** |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceChrome.tsx` | **189** | uendret i runden |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspacePropertiesRail.tsx` | **810** | uendret i runden |

**Nye filer (FASE 22):** `contentWorkspaceRightRailViewModel.ts`, `contentWorkspaceRightRailSlots.ts`.

---

## Gjenværende right-rail shell-monolitt i ContentWorkspace før FASE 22

Verifisert i **`ContentWorkspace.tsx`** før uttrekk:

- **`rightRailSlots`:** `useMemo` med **~200+ linjer** (nested `buildRightRail*` + lang dependency-liste) som kun mater `buildContentWorkspaceRightRailSlots`.
- **`chromeShellProperties`:** fortsatt **inline** `chromeShellProperties(...)` i tri-pane wire — tynn kobling til **`ContentWorkspacePropertiesRail`** via eksisterende shell-input (**ingen** ny forretningslogikk i denne runden).

**Ikke mål:** `blocksForLivePreview` / `visualInlineEditApi` / `blockInspectorCtx`, save/publish, `useContentWorkspaceData` / domene-AI-hooks.

---

## 2026-03-27 — FASE 22: `contentWorkspaceRightRailViewModel` + `contentWorkspaceRightRailSlots`

### Hva som ble flyttet

| Modul | Innhold |
|-------|---------|
| **`contentWorkspaceRightRailViewModel.ts`** | `RightRailSlotsWorkspaceParams` som type-snitt av `ContentWorkspaceRightRailSlotsProps` (shell … diagnose). |
| **`contentWorkspaceRightRailSlots.ts`** | `buildRightRail*` (tidligere i **`contentWorkspaceActionGroups.ts`**), `buildRightRailSlotsFromWorkspaceArgs`, `useContentWorkspaceRightRailSlots` — `useMemo` + dependency-liste flyttet ut av parent. |
| **`contentWorkspaceActionGroups.ts`** | **Fjernet** (innhold konsolidert i `contentWorkspaceRightRailSlots.ts`). |
| **`ContentWorkspace.tsx`** | `rightRailSlots` = `useContentWorkspaceRightRailSlots({ … })` med flat VM (samme verdier som før). |

**`blockInspectorCtx`:** **ikke endret** i denne runden.

**Linjetall etter FASE 22:** `ContentWorkspace.tsx` **5178**; `contentWorkspaceRightRailSlots.ts` **496**; `contentWorkspaceRightRailViewModel.ts` **17**.

### Kommandoer (FASE 22, verifisert i samme runde)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings; `react-hooks/exhaustive-deps` scoped i `useContentWorkspaceRightRailSlots`) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

---

## FASE 23 baseline for tracked chrome-modal shell reduction

**Dato:** 2026-03-27 (lokal verifisering).

| Fil | Linjetall (`(Get-Content …).Count`) | Git-status (ved FASE 23-arbeid) |
|-----|-------------------------------------|--------------------------------|
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | **5178** (før FASE 23) | **M** |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceModalShell.tsx` | **169** | uendret i runden |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceModalShellProps.ts` | **259** | uendret i runden |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceChromeShellInput.ts` | **418** | uendret |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceTriPaneMount.tsx` | **20** | uendret |

**Nye filer (FASE 23):** `contentWorkspaceChromeShellViewModel.ts`, `contentWorkspaceModalStackViewModel.ts`.

---

## Gjenværende chrome-modal shell-monolitt i ContentWorkspace før FASE 23

Verifisert i **`ContentWorkspace.tsx`** før uttrekk:

- **Tri-pane wire:** `ContentWorkspaceTriPaneMount` med **inline** `chromeWire` / `auxiliaryWire` (`chromeShell*` / `auxiliaryShell*`-fabrikker) — **~17 linjer** tett kobling.
- **Modal stack:** `buildContentWorkspaceModalShellProps({ … })` med lang props-liste til **`ContentWorkspaceModalShell`**.
- **Publish-/status-rail:** `statusLabel`, `canPublish`, `publishDisabledTitle`, `statusLine`, `publicSlug`, `publishReadiness` m.m. som **inline** `useMemo` / utledning.
- **Overlay-effects:** demo/wow/pitch `useEffect` + onboarding `useEffect` (lokalStorage / steg) som **kun** styrer overlay-atferd.
- **Support snapshot (I4):** `supportSnapshot` + `copySupportSnapshot` for konflikt/offline/error.
- **Historikk-blokker til chrome-main:** `historyPreviewBlocks` `useMemo` (parse + normalize).

**Ikke mål:** `blocksForLivePreview` / `visualInlineEditApi` / `blockInspectorCtx`-flyt, `contentWorkspaceRightRailSlots.ts`, save/publish-kjerne.

---

## 2026-03-27 — FASE 23: `contentWorkspaceChromeShellViewModel` + `contentWorkspaceModalStackViewModel`

### Hva som ble flyttet

| Modul | Innhold |
|-------|---------|
| **`contentWorkspaceChromeShellViewModel.ts`** | `useEditorChromePublishRailState` (tidligere status/publish/slug/statusLine/publishReadiness), `useHistoryPreviewBlocksForChromeShell`, `useChromeShellSupportSnapshot` + `useChromeShellCopySupportSnapshot` (I4), `useEditor2ValidationFromModel` (Editor2-validering). |
| **`contentWorkspaceModalStackViewModel.ts`** | `useContentWorkspaceDemoWowPitchOverlayEffects` (demo/wow/pitch `useEffect`), `useContentWorkspaceOnboardingOverlayEffects` (onboarding-steg). |
| **`ContentWorkspace.tsx`** | Kall til modulene over; tri-pane **`ContentWorkspaceTriPaneMount`** og modal **`buildContentWorkspaceModalShellProps`** uendret i ansvar (samme props/kjede). |

**`blockInspectorCtx`:** **ikke endret** i denne runden.

**Preview-paritet:** `blocksForLivePreview`, `visualInlineEditApi`, `blockInspectorCtx` bygges fortsatt i **`ContentWorkspace.tsx`** med samme kilder som før FASE 23.

**Linjetall etter FASE 23:** `ContentWorkspace.tsx` **5046**; `contentWorkspaceChromeShellViewModel.ts` **~239**; `contentWorkspaceModalStackViewModel.ts` **~142**.

### Kommandoer (FASE 23, verifisert i samme runde)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings; `eslint-disable-next-line` der effekt-deps matcher tidligere inline-kontrakt) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

---

## FASE 20 baseline for tracked presentation-state reduction

**Dato:** 2026-03-27 (lokal verifisering).

| Fil | Linjetall (`(Get-Content …).Count`) | Git-status (ved FASE 20-staging) |
|-----|--------------------------------------|-----------------------------------|
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | **5622** (før FASE 20) | **M** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceChromeShellInput.ts` | **418** | uendret i runden |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceAuxiliaryShellInput.ts` | **247** | uendret i runden |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceTriPaneMount.tsx` | **20** | uendret i runden |

**Nye filer (FASE 20):** `contentWorkspacePresentationSelectors.ts`, `useContentWorkspacePresentationState.ts`.

---

## Gjenværende presentation-state-monolitt i ContentWorkspace før FASE 20

Verifisert i **`ContentWorkspace.tsx`** før uttrekk:

- **Lokal liste-/sidebar-UI:** `queryInput` / `query`, `hjemExpanded`, `createPanelOpen` / `createPanelMode`.
- **Global design / header-mock:** `headerVariant`, `headerEdit*`, navigasjons-synlighet, farger, `labelColors`, retning, e-postplattform, captcha, notifikasjon.
- **Mediapicker (UI-overlay):** `mediaPickerOpen`, `mediaPickerTarget`.
- **Hjelper-funksjoner i fila:** `safeStr`, `normalizeSlug`, `formatDate`, `getStatusLineState`, `neighborAiPreamble` — rene presentasjons-/derive-hjelpere.
- **Død duplikatkode:** lokal `buildAiBlocks` / `buildAiExistingBlocks` / `buildAiMeta` / `extractAiSummary` (kanon allerede i **`contentWorkspace.ai.ts`** / hook) — **~220+ linjer** uten runtime-bruk i parent.

**Ikke mål:** `blocksForLivePreview` / `visualInlineEditApi` / `blockInspectorCtx`-hooks, save/publish, `useContentWorkspaceData` / `useContentWorkspaceBlocks`.

---

## 2026-03-27 — FASE 20: `useContentWorkspacePresentationState` + `contentWorkspacePresentationSelectors`

### Hva som ble flyttet

| Modul | Innhold |
|-------|---------|
| **`useContentWorkspacePresentationState.ts`** | `useState` for sideliste/søk, create-panel åpen/modus, global design/header-mock, farger/toggles, mediapicker — **kun** presentasjons-/paneltilstand. |
| **`contentWorkspacePresentationSelectors.ts`** | `safeStr`, `normalizeSlug`, `formatDate`, `getStatusLineState`, `neighborAiPreamble` — rene funksjoner uten sideeffekter. |
| **`ContentWorkspace.tsx`** | Fjernet **død** duplikat **`buildAiBlocks`** (m.fl.) som allerede finnes i **`contentWorkspace.ai.ts`**; fjernet ubrukt **`AiToolId`** / **`extractAiSummary`** lokalt; **`cloneBlockDeep`** beholdt i parent (liten, blokklokal). |

**`blockInspectorCtx`:** **ikke endret** i denne runden (samme kilde og flyt).

**Linjetall etter FASE 20:** `ContentWorkspace.tsx` **5391**; `contentWorkspacePresentationSelectors.ts` **92**; `useContentWorkspacePresentationState.ts` **119**.

### Kommandoer (FASE 20, verifisert i samme runde)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings + ev. nye deps-varsler i `ContentWorkspace.tsx`) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

---

## FASE 24 baseline for tracked tri-pane modal shell reduction

**Dato:** 2026-03-27 (lokal verifisering).

| Fil | Linjetall (`(Get-Content …).Count` i PowerShell) | Git-status (før FASE 24-staging) |
|-----|--------------------------------------------------|----------------------------------|
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | **5046** (før uttrekk; jf. POST_IMPLEMENTATION_REVIEW FASE 23) | **M** |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceTriPaneMount.tsx` | **20** | sporet etter behov |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceChromeShellInput.ts` | **418** | uendret i kjernen |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceAuxiliaryShellInput.ts` | **247** | uendret i kjernen |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceModalShellProps.ts` | **259** | uendret i kjernen |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceChromeShellViewModel.ts` | **239** | uendret i kjernen |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceModalStackViewModel.ts` | **142** | uendret i kjernen |

**Nye filer (FASE 24):** `contentWorkspaceTriPaneShellViewModel.ts`, `contentWorkspaceModalShellInput.ts`, `contentWorkspaceShellMountFragments.ts`, `ContentWorkspaceEditor2ShellMount.tsx`, `ContentWorkspaceConflictStatusShell.tsx`, `ContentWorkspacePendingNavigationBanner.tsx`, `ContentWorkspaceDevDebugOverlays.tsx`, `ContentWorkspaceDetailRouteShell.tsx`, `ContentWorkspaceDesignTabHeader.tsx`.

---

## Gjenværende tri-pane-modal shell-monolitt i ContentWorkspace før FASE 24

Verifisert i **`ContentWorkspace.tsx`** før uttrekk:

- **`chromeWire` / `auxiliaryWire`:** inline objekt-literal med kall til `chromeShellFrame` … `chromeShellTri` og `auxiliaryShellIdentity` … `auxiliaryShellAiPitch` rett i parent.
- **`ContentWorkspaceTriPaneMount`:** montert med full wire-assembly i samme fil.
- **`buildContentWorkspaceModalShellProps({ ... })`:** ett stort inline argument-objekt nederst i fila (modal-/overlay-/onboarding-/pitch-binding).
- **Tilhørende JSX:** Editor2-gren, konflikt-status (I1/I4), pending navigasjon, dev-HUD, tom/loading/feil/route-placeholders, Shop Design tab-header — ren shell-/presentasjon uten å endre preview- eller lagringskjede.

**Ikke mål:** `blocksForLivePreview` / `visualInlineEditApi` / `blockInspectorCtx`-hooks, save/publish, blokkmodell, API, `contentWorkspaceRightRailSlots.ts` utover konsumering.

---

## 2026-03-27 — FASE 24: tri-pane wire-buildere + modal-shell importflate + shell-fragmenter

### Hva som ble flyttet

| Modul | Innhold |
|-------|---------|
| **`contentWorkspaceTriPaneShellViewModel.ts`** | `buildContentWorkspaceTriPaneMountChromeWire` / `buildContentWorkspaceTriPaneMountAuxiliaryWire` (grupperer fabrikk-resultater); re-eksport **`ContentWorkspaceTriPaneMount`**. |
| **`contentWorkspaceModalShellInput.ts`** | Re-eksport av **`buildContentWorkspaceModalShellProps`** + **`ContentWorkspaceModalShell`**. |
| **`contentWorkspaceShellMountFragments.ts`** | Barrel for Editor2-mount, konflikt, pending navigasjon, dev-HUD, detail-route-placeholders. |
| **`ContentWorkspaceEditor2ShellMount.tsx`** | Tynn **`Editor2Shell`**-wrapper. |
| **`ContentWorkspaceConflictStatusShell.tsx`** | Konflikt UI (statuslinje + panel). |
| **`ContentWorkspacePendingNavigationBanner.tsx`** | Usikret navigasjon. |
| **`ContentWorkspaceDevDebugOverlays.tsx`** | Dev HUD. |
| **`ContentWorkspaceDetailRouteShell.tsx`** | Tom valg, ikke funnet, detail loading/feil, editor-area loading, global panel «kommer snart». |
| **`ContentWorkspaceDesignTabHeader.tsx`** | Shop Design H1 + tab-rad. |

**`blockInspectorCtx`:** **ikke endret** i denne runden (samme kilde og flyt).

**Linjetall etter FASE 24:** `ContentWorkspace.tsx` **4940** (under hardt minimum 4950).

### Kommandoer (FASE 24, verifisert i samme runde)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

### Preview-paritet (FASE 24)

Samme preview-kjede som før: `blocksForLivePreview`, `visualInlineEditApi` og `blockInspectorCtx` bygges og sendes inn i **`chromeShellMain`** / **`ContentWorkspaceChrome`** uendret; nye moduler er **kun** pass-through / JSX-flytting og introduserer ingen alternativ render-logikk for preview.

---

## FASE 25 baseline for tracked shell args reduction

**Dato:** 2026-03-27 (lokal verifisering).

| Fil | Linjetall (`(Get-Content …).Count`) | Git-status (working tree før FASE 25-staging) |
|-----|-------------------------------------|---------------------------------------------|
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | **~4943** (før FASE 25-impl. i denne runden) | **M** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceTriPaneShellViewModel.ts` | **45** | **A** eller **M** (avhengig av branch) |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceModalShellInput.ts` | **10** | **A** eller **M** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceChromeShellInput.ts` | **418** | **M** typisk |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceAuxiliaryShellInput.ts` | **247** | **M** typisk |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceChromeShellArgs.ts` | **152** (etter utvidelse) | **A** eller **M** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceModalShellArgs.ts` | **84** | **A** eller **M** |

**Merk:** Baseline for **`ContentWorkspace.tsx`** er **faktisk linjetall før** shell-args-uttrekk i FASE 25 (ca. **4943**); **etter** FASE 25: **4845** linjer.

---

## Gjenværende shell args-monolitt i ContentWorkspace før FASE 25

Verifisert i **`ContentWorkspace.tsx`** før uttrekk:

- **`chromeWire`:** `buildContentWorkspaceTriPaneMountChromeWire(chromeShellFrame(…), chromeShellShared(…), chromeShellEditor(…), chromeShellMain(…), chromeShellProperties(…), chromeShellTri(…))` med **svært lang** `chromeShellMain(…)`-argumentliste og tilhørende bindinger.
- **`auxiliaryWire`:** `buildContentWorkspaceTriPaneMountAuxiliaryWire(auxiliaryShellIdentity(…), …, auxiliaryShellAiPitch(…))` med lang `auxiliaryShellAiPitch`-liste.
- **`buildContentWorkspaceModalShellPropsFromWorkspaceSlices({ fullPageAi, blockAndPicker, onboardingPitch })`:** tre store objekt-literaler (før komprimering **~20** linjer nederst i fila).
- **`blocksForLivePreview`:** egen `useMemo`; **`visualPreviewFieldHints`** + **`visualInlineEditApi`:** to `useMemo` som kalte **`buildVisualPreviewFieldHintsMap`** / **`buildVisualInlineEditApiForChromeShell`** (allerede i **`contentWorkspaceChromeShellArgs.ts`**).
- **`isPitch` / `isWow` / `isDemo`:** tre `useMemo` på `window.location.search` i parent.

**Ikke mål:** preview-pipeline, `blockInspectorCtx`-kontrakt, save/publish, blokkmodell, API.

---

## 2026-03-27 — FASE 25: `useChromeVisualPreviewShellPair` + `useContentWorkspaceUrlModeFlags` + import-/modal-slice-komprimering

### Hva som ble flyttet / eies nå

| Modul | Innhold |
|-------|---------|
| **`contentWorkspaceChromeShellArgs.ts`** | **`"use client"`**; **`useChromeVisualPreviewShellPair`**: samme to `useMemo` som tidligere lå i **`ContentWorkspace.tsx`** (felt-hints + `visualInlineEditApi`); **`useContentWorkspaceUrlModeFlags`**: `isPitch` / `isWow` / `isDemo` fra `window.location.search`. Eksisterende **`buildVisualPreviewFieldHintsMap`** / **`buildVisualInlineEditApiForChromeShell`** uendret i semantikk. |
| **`ContentWorkspace.tsx`** | Kortere import-seksjon (samme symboler); modal-shell **`buildContentWorkspaceModalShellPropsFromWorkspaceSlices`** med **én linje per slice** der det er trygt; kompakt **`useChromeVisualPreviewShellPair({ … })`**-kall. Tri-pane **`chromeShell*` / `auxiliaryShell*`-kall** forblir i parent (**ingen** flytting av `chromeShellMain`-mega-listen i denne runden utover redusert støy rundt). |

**`contentWorkspaceModalShellArgs.ts`:** **ingen** logikkendring i FASE 25 (fortsatt **`buildContentWorkspaceModalShellPropsFromWorkspaceSlices`** → **`buildContentWorkspaceModalShellProps`**).

**`blockInspectorCtx`:** **ikke endret** i denne runden.

### Linjetall etter FASE 25

| Fil | Linjer |
|-----|--------|
| **`ContentWorkspace.tsx`** | **4845** (hardt minimum **&lt;4850** oppfylt) |
| **`contentWorkspaceChromeShellArgs.ts`** | **152** |

### Kommandoer (FASE 25, verifisert)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS (193 filer, 1133 tester) |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

### Preview-paritet (FASE 25)

Samme preview-kjede: **`blocksForLivePreview`** bygges i **`ContentWorkspace.tsx`** som før; **`visualInlineEditApi`** / **`visualPreviewFieldHints`** er **identisk** `useMemo`-semantikk via **`useChromeVisualPreviewShellPair`**; **`blockInspectorCtx`** uendret. Ingen alternativ render-logikk.

---

## FASE 26 baseline for tracked tri-pane args slicing

**Dato:** 2026-03-27 (lokal verifisering).

| Fil | Linjetall (`(Get-Content …).Count`) | Git-status (working tree før FASE 26) |
|-----|--------------------------------------|----------------------------------------|
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | **4845** | **M** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceChromeShellArgs.ts` | **152** | **A** / **M** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceChromeShellInput.ts` | **418** | **M** / **??** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceAuxiliaryShellInput.ts` | **247** | **M** / **??** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceTriPaneShellViewModel.ts` | **45** | **A** / **M** |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceTriPaneMount.tsx` | **20** | **??** |

**Nye filer (FASE 26):** `contentWorkspaceTriPaneChromeArgs.ts`, `contentWorkspaceTriPaneAuxiliaryArgs.ts` (linjetall etter impl. i tabellen under FASE 26-seksjon).

---

## Gjenværende tri-pane args-monolitt i ContentWorkspace før FASE 26

Verifisert i **`ContentWorkspace.tsx`** før uttrekk:

- **`chromeWire`:** `buildContentWorkspaceTriPaneMountChromeWire(chromeShellFrame(…), …, chromeShellMain(…), …)` med **seks** posisjonelle `chromeShell*`-kall rett i JSX.
- **`auxiliaryWire`:** `buildContentWorkspaceTriPaneMountAuxiliaryWire(auxiliaryShellIdentity(…), …, auxiliaryShellAiPitch(…))` med **fem** `auxiliaryShell*`-kall i parent.
- **Imports:** `chromeShell*` / `auxiliaryShell*` fra **`contentWorkspaceShellInputContexts`** kun for tri-pane-monteringen.
- **Ikke** egen `useMemo` kun for tri-pane wire i siste kjente versjon — bindingene lå inline i mount-kallet.

**Ikke mål:** preview-kjede, `blockInspectorCtx`, save/publish, blokkmodell, API, AI-semantikk.

---

## 2026-03-27 — FASE 26: `contentWorkspaceTriPaneChromeArgs` + `contentWorkspaceTriPaneAuxiliaryArgs`

### Hva som ble flyttet / eies nå

| Modul | Innhold |
|-------|---------|
| **`contentWorkspaceTriPaneChromeArgs.ts`** | **`buildContentWorkspaceTriPaneMountChromeWireFromWorkspaceSlices`**: typed **`TriPaneChromeFrameSlice`** (navngitt `hideLegacyNav` vs. `hideLegacySidebar` i parent); **`shared` / `editor` / `main` / `properties` / `tri`** som **`Parameters<typeof chromeShell*>`**-tupler spredd til **`chromeShellShared`**, **`chromeShellEditor`**, **`chromeShellMain`**, **`chromeShellProperties`**, **`chromeShellTri`**. Kaller **`buildContentWorkspaceTriPaneMountChromeWire`** — samme wire som før. |
| **`contentWorkspaceTriPaneAuxiliaryArgs.ts`** | **`buildContentWorkspaceTriPaneMountAuxiliaryWireFromWorkspaceSlices`**: **`identity` / `detail` / `save` / `pageBody` / `aiPitch`** som tupler (`Parameters<typeof auxiliaryShell*>`) → **`auxiliaryShell*`** → **`buildContentWorkspaceTriPaneMountAuxiliaryWire`**. |
| **`ContentWorkspace.tsx`** | Fjerner direkte import av **`chromeShell*`** / **`auxiliaryShell*`** for tri-pane; bruker slice-byggere; **import-seksjon** strammet; **88** overflødige tomme linjer fjernet (kun vertikal luft, ingen logikk). |

**`blockInspectorCtx`:** **ikke endret** i denne runden (fortsatt samme binding inn i **`main`**-tuple).

### Linjetall etter FASE 26

| Fil | Linjer |
|-----|--------|
| **`ContentWorkspace.tsx`** | **4745** (hardt minimum **&lt;4750** oppfylt) |
| **`contentWorkspaceTriPaneChromeArgs.ts`** | **58** |
| **`contentWorkspaceTriPaneAuxiliaryArgs.ts`** | **36** |

### Kommandoer (FASE 26, verifisert)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

### Preview-paritet (FASE 26)

Samme preview-kjede: **`blocksForLivePreview`**, **`visualInlineEditApi`**, **`blockInspectorCtx`** mates inn i **`main`**-tuple og videre til chrome-wire **som før**; nye moduler er **kun** pass-through til eksisterende **`chromeShell*`** / **`auxiliaryShell*`** og **`buildContentWorkspaceTriPaneMount*`** — **ingen** alternativ preview-render-logikk.

---

## FASE 26B baseline for semantic tri-pane/modal slice reduction

**Dato:** 2026-03-27 (lokal verifisering).

| Filsti | Linjetall (`(Get-Content …).Count`) | Git-status (før 26B-staging) |
|--------|-------------------------------------|------------------------------|
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | **4745** | **M** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceTriPaneChromeArgs.ts` | **58** | **M** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceTriPaneAuxiliaryArgs.ts` | **36** | **M** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceModalShellInput.ts` | **10** | **M** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceModalShellArgs.ts` | **84** | **M** |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceTriPaneMount.tsx` | **20** | **M** |

**Merk:** Baseline-linjetall for **`ContentWorkspace.tsx`** er **før** 26B-semantisk uttrekk (posisjonelle **`main`**/**`aiPitch`**-tupler + ingen `contentWorkspaceShellUiConstants`).

### Gjenværende semantic tri-pane/modal args-monolitt før FASE 26B

Verifisert i **`ContentWorkspace.tsx`** (pre-26B):

- **`chromeShellMain(...)`-input:** én lang **posisjonell tuple** til **`main:`** i **`buildContentWorkspaceTriPaneMountChromeWireFromWorkspaceSlices`** (alle canvas/preview/inspector-felter inkl. **`blocksForLivePreview`**, **`visualInlineEditApi`**, **`blockInspectorCtx`**).
- **`auxiliaryShellAiPitch(...)`-input:** én lang **posisjonell tuple** til **`aiPitch:`** (demo/pitch/WOW-felter, **`IMAGE_PRESETS`** / **`DEMO_BLOCKS`** som posisjonelle argumenter).
- **Modal-shell:** **`buildContentWorkspaceModalShellPropsFromWorkspaceSlices({ fullPageAi, blockAndPicker, onboardingPitch })`** med tre **inline** objekter i parent.
- **Memo/dependency-støy:** ingen endring i denne runden (ingen nye `useMemo` kun for disse slicene).

---

## 2026-03-27 — FASE 26B: `ChromeShellMainOnly` + `AuxiliaryShellAiPitch` i tri-pane; modal-slices fasade; UI-konstanter

### Hva som ble flyttet / eies nå

| Modul | Innhold |
|-------|---------|
| **`contentWorkspaceTriPaneChromeArgs.ts`** | **`main`** er **`ChromeShellMainOnly`** (objekt) — **direkte** inn i **`buildContentWorkspaceTriPaneMountChromeWire`** uten **`chromeShellMain(...tuple)`** i slice-byggeren. |
| **`contentWorkspaceTriPaneAuxiliaryArgs.ts`** | **`aiPitch`** er **`AuxiliaryShellAiPitch`** (objekt) — **`imagePresetLabels`** / **`demoBlocks`** som navngitte felt (ikke posisjonell tuple). |
| **`contentWorkspaceModalShellSlices.ts`** | Tynn re-eksport av **`buildContentWorkspaceModalShellPropsFromWorkspaceSlices`** + slice-typer (`ModalShell*Slice`). |
| **`contentWorkspaceShellUiConstants.ts`** | Statiske placeholder-lister (tabs, design/typografi, navigasjon, globale kort) — **ingen** hooks, **ingen** preview-logikk. |

**`blockInspectorCtx`:** **ikke endret** som kontrakt; fortsatt samme binding inn i **`main`**-objektet som tidligere i tuplen.

### Linjetall etter FASE 26B

| Fil | Linjer |
|-----|--------|
| **`ContentWorkspace.tsx`** | **4690** (krav: **&lt;4700**) |
| **`contentWorkspaceTriPaneChromeArgs.ts`** | **64** |
| **`contentWorkspaceTriPaneAuxiliaryArgs.ts`** | **44** |
| **`contentWorkspaceModalShellSlices.ts`** | **11** |
| **`contentWorkspaceShellUiConstants.ts`** | **238** |

### Kommandoer (FASE 26B — verifisert 2026-03-27)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

### Preview-paritet (FASE 26B)

Samme kilde og flyt for **`blocksForLivePreview`**, **`visualInlineEditApi`**, **`blockInspectorCtx`** — nå som **navngitte** felt på **`main`**-objektet som tilsvarer **`ChromeShellMainOnly`**; ingen alternativ render-kjede.

---

## FASE 27 baseline for semantic shared-editor-properties-tri slicing

**Dato:** 2026-03-28 (lokal verifisering).

| Filsti | Linjetall (`(Get-Content …).Count`) | Git-status (før FASE 27-staging) |
|--------|-------------------------------------|-----------------------------------|
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | **4690** (FASE 26B-avslutning) | **M** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceTriPaneChromeArgs.ts` | **64** | **M** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceTriPaneAuxiliaryArgs.ts` | **44** | **M** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceModalShellSlices.ts` | **11** | **M** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceModalShellArgs.ts` | **84** | **M** |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceTriPaneMount.tsx` | **20** | **M** |

### Gjenværende semantic tri-pane shared-editor-properties-tri + modal-slices før FASE 27

Verifisert i **`ContentWorkspace.tsx`** (pre-27):

- **`shared`:** posisjonell **tuple** til **`chromeShellShared`** via **`buildContentWorkspaceTriPaneMountChromeWireFromWorkspaceSlices`**.
- **`editor`:** posisjonell **tuple** til **`chromeShellEditor`**.
- **`properties`:** posisjonell **tuple** til **`chromeShellProperties`**.
- **`tri`:** posisjonell **tuple** til **`chromeShellTri`**.
- **`main`:** **`ChromeShellMainOnly`**-objekt (FASE 26B).
- **Modal:** tre **nestede** slice-objekter til **`buildContentWorkspaceModalShellPropsFromWorkspaceSlices`** (`fullPageAi` / `blockAndPicker` / `onboardingPitch`).

---

## 2026-03-28 — FASE 27: `ChromeShellShared`/`Editor`/`Properties`/`Tri` som objekter; `build*FromFields`; flat modal; bundle-import

### Hva som ble flyttet / eies nå

| Modul | Innhold |
|-------|---------|
| **`contentWorkspaceTriPaneChromeArgs.ts`** | **`shared`**/**`editor`**/**`properties`**/**`tri`** er **`ChromeShellShared`** / **`ChromeShellEditorOnly`** / **`ChromeShellProperties`** / **`ChromeShellTri`** (samme som `chromeShell*`-retur); **`buildChromeShell*SliceFromFields`** + **`buildChromeShellMainOnlyFromFields`** er pass-through fra posisjonelle argumenter. **`buildContentWorkspaceTriPaneMountChromeWireFromWorkspaceSlices`** mater wire direkte uten `...tuple`. |
| **`contentWorkspaceTriPaneAuxiliaryArgs.ts`** | **`buildAuxiliaryShellAiPitchFromFields`** — én linje i parent for **`aiPitch`**. |
| **`contentWorkspaceModalShellSlices.ts`** | **`buildContentWorkspaceModalShellPropsFromWorkspaceFlatFields`** — **`BuildContentWorkspaceModalShellPropsArgs`** → **`buildContentWorkspaceModalShellProps`**. |
| **`contentWorkspaceTriPaneShellBundle.ts`** | Re-eksport av tri-pane + modal slice-byggere — én importflate i **`ContentWorkspace.tsx`**. |

**`blockInspectorCtx`:** **ikke endret** i denne runden (fortsatt samme argument i **`buildChromeShellMainOnlyFromFields`**).

### Linjetall etter FASE 27

| Fil | Linjer |
|-----|--------|
| **`ContentWorkspace.tsx`** | **4596** (krav: **&lt;4600**) |
| **`contentWorkspaceTriPaneChromeArgs.ts`** | **105** |
| **`contentWorkspaceTriPaneAuxiliaryArgs.ts`** | **52** |
| **`contentWorkspaceModalShellSlices.ts`** | **23** |
| **`contentWorkspaceTriPaneShellBundle.ts`** | **18** (ny) |

### Kommandoer (FASE 27 — verifisert 2026-03-28)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` |

### Preview-paritet (FASE 27)

Samme **`blocksForLivePreview`** / **`visualInlineEditApi`** / **`blockInspectorCtx`**-flyt; nye moduler er **kun** pass-through og **ingen** alternativ preview-render-logikk.

---

## FASE 28 baseline for semantic tri-pane bundle reduction

**Dato:** 2026-03-28 (lokal verifisering).

| Filsti | Linjetall | Git (før FASE 28-staging; typisk) |
|--------|-----------|-----------------------------------|
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | **4596** (FASE 27 slutt) | **M** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceTriPaneChromeArgs.ts` | **105** | **M** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceTriPaneAuxiliaryArgs.ts` | **52** | **M** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceTriPaneShellBundle.ts` | **18** | **M** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceModalShellSlices.ts` | **23** | **M** |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceTriPaneMount.tsx` | **20** | **M** |

### Gjenværende semantic tri-pane auxiliary + shell-bundle-monolitt før FASE 28

I **`ContentWorkspace.tsx`** (pre-28):

- **`identity` / `detail` / `save` / `pageBody`:** fortsatt **tupler** (`[...]`) inn i **`buildContentWorkspaceTriPaneMountAuxiliaryWireFromWorkspaceSlices`** (spredd til **`auxiliaryShell*`** i hjelpemodul).
- **Tri-pane chrome:** parent eide **kjeden** **`buildChromeShell*FromFields`** + **`buildContentWorkspaceTriPaneMountChromeWireFromWorkspaceSlices`** (lang `chromeWire={...}`).
- **`aiPitch`:** **`buildAuxiliaryShellAiPitchFromFields(...)`** på én linje i parent.
- **Modal:** allerede **`buildContentWorkspaceModalShellPropsFromWorkspaceFlatFields`** — ikke videre gruppert i denne runden.
- **Memo:** ingen separat **`useMemo`** kun for tri-pane shell bundle utover eksisterende workspace-memoer.

---

## 2026-03-28 — FASE 28: Typed `AuxiliaryShellWireInput` + samlet tri-pane bundle-kall + import-/prompt-uttrekk

### Hva som ble flyttet / eies nå

| Modul | Innhold |
|-------|---------|
| **`contentWorkspaceTriPaneAuxiliaryArgs.ts`** | **`buildContentWorkspaceTriPaneMountAuxiliaryWireFromWorkspaceSlices(s: AuxiliaryShellWireInput)`** — **ingen** tupler; **`identity` / `detail` / `save` / `pageBody`** er **navngitte objekter** (`AuxiliaryShellIdentity` m.m.); **`buildAuxiliaryShellAiPitchFromFields`** beholdt. |
| **`contentWorkspaceTriPaneShellBundle.ts`** | **`buildContentWorkspaceTriPaneShellMountPropsFromWorkspaceBundle`** eier **hele** kjeden **`buildChromeShell*FromFields`** → chrome wire + **`AuxiliaryShellWireInput`** → auxiliary wire; **`ContentWorkspaceTriPaneMount`** re-eksportert; øvrige re-eksport som FASE 27. |
| **`contentWorkspaceWorkspaceRootImports.ts`** (ny) | `export *` fra **stubs** / **blocks** / **outbox** / **helpers** / **api** / **ai** / **preview** / **inspectorCtx** / **blockReorder** / **chromeShellArgs** — én importflate for **`ContentWorkspace.tsx`** (ingen ny logikk). |
| **`contentWorkspaceImagePromptShell.ts`** (ny) | **`extractWorkspaceBlockText`**, **`buildWorkspaceImagePrompt`**, **`resolveWorkspaceImagePreset`** — ren flytting av bilde-prompt/preset-strenger (samme tekst som før); **ikke** preview-pipeline. |
| **`ContentWorkspace.tsx`** | **`EditorK.*` / `ShellUi.*`** for editor- og shell-UI-konstanter; tri-pane mount via **`{...buildContentWorkspaceTriPaneShellMountPropsFromWorkspaceBundle({ frame, chrome: { shared/editor/main/properties/tri tuples }, auxiliary: { identity, detail, save, pageBody, aiPitch } })}`**; import av workspace root + image prompt shell. |

**`blockInspectorCtx`:** **ikke endret** i denne runden (samme referanse inn i **`chrome.main`**-tuple).

### Linjetall etter FASE 28

| Fil | Linjer |
|-----|--------|
| **`ContentWorkspace.tsx`** | **4497** (krav: **&lt;4500**) |
| **`contentWorkspaceTriPaneShellBundle.ts`** | **74** |
| **`contentWorkspaceTriPaneAuxiliaryArgs.ts`** | **34** |
| **`contentWorkspaceTriPaneChromeArgs.ts`** | **105** (uendret logikk) |
| **`contentWorkspaceModalShellSlices.ts`** | **22** |
| **`ContentWorkspaceTriPaneMount.tsx`** | **20** |
| **`contentWorkspaceWorkspaceRootImports.ts`** | **15** (ny) |
| **`contentWorkspaceImagePromptShell.ts`** | **97** (ny) |

### Kommandoer (FASE 28 — verifisert 2026-03-28)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` (gjenværende risiko ved minne) |

### Preview-paritet (FASE 28)

Samme **`blocksForLivePreview`** / **`visualInlineEditApi`** / **`blockInspectorCtx`**-kilde og -flyt; nye slice-/bundle-/prompt-moduler er **kun** pass-through eller **identisk** strengflytting — **ingen** alternativ preview-render-logikk.

---

## FASE 29 baseline for semantic mainView/global-shell extraction

**Dato:** 2026-03-28 (lokal verifisering).

| Fil | Linjetall (`(Get-Content …).Count` i PowerShell) | Git-status (før FASE 29-staging) |
|-----|--------------------------------------------------|----------------------------------|
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | **4498** (før uttrekk, `node` `split(/\\r?\\n/)`) | **M** (modified) |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceTriPaneShellBundle.ts` | **74** | avhengig av arbeidskopi |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceTriPaneChromeArgs.ts` | **105** | avhengig av arbeidskopi |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceTriPaneAuxiliaryArgs.ts` | **34** | avhengig av arbeidskopi |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceModalShellSlices.ts` | **22** | avhengig av arbeidskopi |

**Merk:** Tri-pane-filene over er **ikke** endret i FASE 29; de listes kun som sporbar baseline ved siden av `ContentWorkspace.tsx`.

### Gjenværende semantic mainView/global-shell monolitt før FASE 29

Før uttrekk lå fortsatt i **`ContentWorkspace.tsx`** (design-gren):

- **`mainView === "design"`:** stor **tab-byttet** JSX for **Layout**, **Logo**, **Colors** (palett, baseline, tilleggsfarger, etiketter, desktop preview), **Fonts**, **Backgrounds**, **CSS**, **JavaScript**, **Advanced**, ukjent fane-placeholder, samt **Design / Shop Design** save-bar — alt som **presentasjon** med props fra `useContentWorkspacePresentationState` (farger, `labelColors`, …).
- **`mainView === "global"`** og underfaner (**innhold og innstillinger**, **reusable components**, **header** m. konfig, **footer**, **navigation**, **global** rot m. `GLOBAL_WORKSPACE_PANEL_CARDS`): fortsatt **lang kjede** av **top-level** JSX (kort, seksjoner, faner, footere) — **ikke** flyttet i denne runden.

**Callbacks / memo** som primært matet design-**presentasjons-JSX** (f.eks. `setColorsContentBg`, `setLabelColors`) ble **ikke** flyttet ut av hooks; de **videresendes** kun som props til nye shell-komponenter.

### FASE 29: hva som ble flyttet (presentasjon / view-shell)

| Modul | Ansvar |
|-------|--------|
| **`ContentWorkspaceMainViewShell.tsx`** | **Layout**- og **Logo**-faner under design; **`ContentWorkspaceMainViewShellColorsLead`**: **Colors**-fanen del 1 (palett + baseline-seksjoner) — **props-only**, samme state-kilder som før. |
| **`ContentWorkspaceMainViewShellCont.tsx`** | **`ContentWorkspaceMainViewShellColorsContinuation`**: **Colors** del 2 (tilleggsfarger, etiketter) — rendres inne i venstrekolonne sammen med Lead; **`ContentWorkspaceMainViewShellCont`**: **Fonts** + **Backgrounds** under design. |
| **`ContentWorkspace.tsx`** | Eier **`{designTab === "Colors" && (`** **grid** + **venstrekolonne-wrapper** + **høyre preview-kolonne** (sticky desktop preview) — **samme struktur** som før uttrekk; **CSS**, **JavaScript**, **Advanced**, placeholder og **Design** save-bar** forblir i parent. |

**`blockInspectorCtx`:** **ikke endret** i denne runden.

### Linjetall etter FASE 29 (verifisert etter endring)

| Fil | `(Get-Content …).Count` |
|-----|-------------------------|
| `ContentWorkspace.tsx` | **3983** |
| `ContentWorkspaceMainViewShell.tsx` | **275** |
| `ContentWorkspaceMainViewShellCont.tsx` | **331** |

### Kommandoer (FASE 29 — verifisert 2026-03-28)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` (gjenværende risiko ved minne) |

### Preview-paritet (FASE 29)

Samme **`blocksForLivePreview`** / **`visualInlineEditApi`** / **`blockInspectorCtx`**-kilde og -flyt; nye **mainView/design-shell**-komponenter er **kun** presentasjon og props-pass-through — **ingen** alternativ preview-render-logikk og **ingen** endring i tri-pane-/editor-preview-kjeden.

---

## FASE 30 baseline for semantic global-mainView extraction

**Dato:** 2026-03-28 (lokal verifisering).

| Fil | Linjetall (`(Get-Content …).Count` i PowerShell) | Git-status (før FASE 30-staging) |
|-----|--------------------------------------------------|----------------------------------|
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | **3983** (FASE 29-levert; før global **content-and-settings**-uttrekk) | **M** (modified) |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceMainViewShell.tsx` | **275** | sporet / **M** eller **A** |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceMainViewShellCont.tsx` | **332** | sporet / **M** eller **A** |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceTriPaneShellBundle.ts` | **75** | uendret i FASE 30 |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceModalShellSlices.ts` | **23** | uendret i FASE 30 |

**Merk:** Shell-/tri-pane-tall over er **baseline ved FASE 30-start** (tri-pane/modal-slice **ikke** endret i denne runden).

### Gjenværende semantic global-mainView monolitt før FASE 30

Før uttrekk lå i **`ContentWorkspace.tsx`** under **`mainView === "global"`** og **`globalSubView === "content-and-settings"`** en **samlet** JSX-blokk (~430+ linjer) med:

- **Global-underfaner** (`ShellUi.CONTENT_SETTINGS_TAB_TUPLES`) og **tilbake**-rad + **H1** «Innhold og innstillinger».
- **Generell**-panel: **`GlobalDesignSystemSection`**, nettstedsfelter, **LTR/RTL** (`contentDirection`), søk/404-placeholders.
- **Analytics**-panel (GA, GTM, pixels).
- **Skjema**-panel: e-postplattform, CAPTCHA-rutenett, hCaptcha-nøkler (`emailPlatform`, `captchaVersion`).
- **Globalt innhold**, **varsling** (`notificationEnabled`), **scripts**-tekstfelt, **avansert**-rad, **footer**-lagre-rad («Lagre» / «Lagre og publiser»).
- **State** forble i **`useContentWorkspaceOverlays`** (`contentSettingsTab`) og **`useContentWorkspacePresentationState`** (retning, e-post, captcha, varsling) — **ingen** flytting av hooks.

**Fortsatt i parent etter typisk global-gren:** **`reusable-components`**, **header** (m. API-seksjoner), **footer**, **navigation**, **global** rot med `GLOBAL_WORKSPACE_PANEL_CARDS`, **page**-gren under global, samt **design**-rest (**CSS** / **JavaScript** / **Advanced** + save-bar) — **ikke** mål i denne uttrekk-runden.

### FASE 30: hva som ble flyttet (presentasjon / view-shell)

| Modul | Ansvar |
|-------|--------|
| **`ContentWorkspaceGlobalMainViewShell.tsx`** | **Innhold og innstillinger** del 1: tilbake, underfaner, **Generell** + **Analytics** — **props-only**; **`GlobalDesignSystemSection`** flyttet hit fra parent-import. |
| **`ContentWorkspaceGlobalMainViewShellCont.tsx`** | **Skjema**, **globalt innhold**, **varsling**, **scripts**, **avansert**, nederste **lagre**-rad — **props-only**. |
| **`ContentWorkspace.tsx`** | Erstatter den inline **content-and-settings**-kjeden med **`<ContentWorkspaceGlobalMainViewShell />`** + **`<ContentWorkspaceGlobalMainViewShellCont />`** inne i eksisterende **`div.space-y-6`**; **fjerner** ubrukt import av **`GlobalDesignSystemSection`**. |

**`blockInspectorCtx`:** **ikke endret** i denne runden.

### Linjetall etter FASE 30 (verifisert etter endring)

| Fil | `(Get-Content …).Count` |
|-----|-------------------------|
| `ContentWorkspace.tsx` | **3566** |
| `ContentWorkspaceGlobalMainViewShell.tsx` | **262** |
| `ContentWorkspaceGlobalMainViewShellCont.tsx` | **247** |

### Kommandoer (FASE 30 — fyll inn etter kjøring)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` (gjenværende risiko ved minne) |

### Preview-paritet (FASE 30)

Samme **`blocksForLivePreview`** / **`visualInlineEditApi`** / **`blockInspectorCtx`**-kilde og -flyt; nye **global content-settings**-shell-komponenter er **kun** presentasjon og props-pass-through — **ingen** alternativ preview-render-logikk.

### Git-merknad (FASE 30 — viktig for `git diff`)

**Semantisk FASE 30-delta** på `ContentWorkspace.tsx` i arbeidskopi som allerede fulgte **FASE 29:** ca. **3983 → 3566** linjer (`(Get-Content …).Count`) ved flytting av **content-and-settings**-JSX til **`ContentWorkspaceGlobalMainViewShell*.tsx`**.

I en klon der **`git show HEAD:.../ContentWorkspace.tsx`** fortsatt er **mye større** (f.eks. **~8309** linjer) fordi refaktorering ikke er committet, vil **`git diff HEAD` / `--cached`** for **`ContentWorkspace.tsx`** vise **hele** arbeidskopi-forskjellen mot **siste commit**, ikke «kun» FASE 30 isolert. **FASE 30-relevante endringer** er likevel: **parent** bytter inn to shell-komponenter + fjerner **`GlobalDesignSystemSection`**-import; **to nye** shell-filer; **dokumentasjon**.

---

## FASE 31 baseline for remaining global-mainView extraction

**Dato:** 2026-03-27 (lokal verifisering).

| Fil | Linjetall (`(Get-Content … \| Measure-Object -Line).Lines` i PowerShell) | Git-status (før FASE 31-staging) |
|-----|------------------------------------------------------------------------|----------------------------------|
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | **3427** (før uttrekk av gjenværende **global**-gren) | **M** |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceGlobalMainViewShell.tsx` | **246** | sporet |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceGlobalMainViewShellCont.tsx` | **233** | sporet |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceTriPaneShellBundle.ts` | **75** | uendret i FASE 31 |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceModalShellSlices.ts` | **23** | uendret i FASE 31 |

### Gjenværende semantic global-mainView branches før FASE 31

Før uttrekk lå i **`ContentWorkspace.tsx`** (etter FASE 30) fortsatt **store** inline-grener under **`mainView === "global"`** (utenom **content-and-settings** som allerede var i **`ContentWorkspaceGlobalMainViewShell*`**):

- **`reusable-components`**: placeholder-kort, «Create Component Group», lagre-rad.
- **`header`**: **`headerVariants`**, valgt variant, **`headerEditConfig`**-skjema, **`DsButton`**, **`fetch` PATCH** mot **`/api/backoffice/content/header-config/...`** (samme kall som før; kun flyttet til **`ContentWorkspaceGlobalHeaderShell`**).
- **`footer`**: **Content/Advanced**-faner, footer items-placeholder, lagre-rad.
- **`navigation`**: **`NAVIGATION_SUB_TAB_TUPLES`**, **main/secondary/footer** + **member/cta/language/advanced**-paneler, lagre-rad.
- **Global rot** (`globalSubView === null`): **H1** «Global», **global/content/info**-faner, **`GLOBAL_WORKSPACE_PANEL_CARDS`**, **`ContentWorkspaceGlobalPanelTabPlaceholder`**.
- **Callbacks/state** for disse grenene: **`exitGlobalSubView`**, **`openGlobalSubViewCard`**, **`globalPanelTab`**, **`footerTab`**, **`navigationTab`**, **`headerVariant`**, **`headerEdit*`** m.m. — **uendret eierskap** (hooks i parent); **ingen** nye hooks i shell-filene.

### FASE 31: hva som ble flyttet (presentasjon / view-shell)

| Modul | Ansvar |
|-------|--------|
| **`ContentWorkspaceGlobalGlobalBranchShell.tsx`** | **Én** komponerende inngang fra parent: **`globalSubView`** → **`ContentWorkspaceGlobalReusableShell`** / **`ContentWorkspaceGlobalHeaderShell`** / **`ContentWorkspaceGlobalFooterShell`** / **`ContentWorkspaceGlobalNavigationShell`** / **`ContentWorkspaceGlobalRootShell`**. **`content-and-settings`** rendres **ikke** her (fortsatt i parent). |
| **`ContentWorkspaceGlobalReusableShell.tsx`** | **reusable-components** |
| **`ContentWorkspaceGlobalHeaderShell.tsx`** | **header** (inkl. **`headerVariants`**, **`selectedVariant`**, PATCH-handling som før) |
| **`ContentWorkspaceGlobalFooterShell.tsx`** | **footer** |
| **`ContentWorkspaceGlobalNavigationShell.tsx`** + **`ContentWorkspaceGlobalNavigationShellPanelsLead.tsx`** + **`ContentWorkspaceGlobalNavigationShellPanelsCont.tsx`** | **navigation** (faner + paneler; **Lead** = main/secondary/footer, **Cont** = member/cta/language/advanced) |
| **`ContentWorkspaceGlobalRootShell.tsx`** | **Global**-rot med panelkort og **info/content**-placeholders |
| **`ContentWorkspace.tsx`** | Erstatter **reusable → … → global rot**-kjeden med **`mainView === "global" ? <ContentWorkspaceGlobalGlobalBranchShell … />`** (etter **`content-and-settings`**-grenen); fjerner **`DsButton`**- og **`ShellUi`**-import som kun ble brukt i flyttet JSX. |

**`blockInspectorCtx`:** **ikke endret** i denne runden.

**Reduksjon:** semantisk flytting av JSX (ingen whitespace-only sletting i parent utover fjernet ubrukt import).

### Linjetall etter FASE 31 (verifisert etter endring)

| Fil | `(Get-Content … \| Measure-Object -Line).Lines` |
|-----|-------------------------------------------------|
| `ContentWorkspace.tsx` | **2527** |
| `ContentWorkspaceGlobalGlobalBranchShell.tsx` | **119** |
| `ContentWorkspaceGlobalHeaderShell.tsx` | **253** |
| `ContentWorkspaceGlobalFooterShell.tsx` | **137** |
| `ContentWorkspaceGlobalNavigationShell.tsx` | **118** |
| `ContentWorkspaceGlobalNavigationShellPanelsLead.tsx` | **256** |
| `ContentWorkspaceGlobalNavigationShellPanelsCont.tsx` | **222** |
| `ContentWorkspaceGlobalReusableShell.tsx` | **101** |
| `ContentWorkspaceGlobalRootShell.tsx` | **70** |

### Kommandoer (FASE 31)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` (gjenværende risiko ved minne) |

### Preview-paritet (FASE 31)

Samme **`blocksForLivePreview`** / **`visualInlineEditApi`** / **`blockInspectorCtx`**-kilde og -flyt; nye **global-mainView**-shell-komponenter er **kun** presentasjon og props-pass-through — **ingen** alternativ preview-render-logikk.

### Rydding

Midlertidige **`_fase31_*.txt`** under `_components/` og hjelpescript **`scripts/splice-fase31-content-workspace.mjs`** fjernet etter uttrekk (unngå rot i repo).

---

## 2026-03-28 — FASE 32 REPAIR: `ContentWorkspacePageEditorShell` kontrakt A + linjebudsjett

### Mål

- **Én tri-pane-kontrakt (A):** `ContentWorkspacePageEditorShell` mottar **`triPaneBundleInput`** (`ContentWorkspaceTriPaneShellBundleWorkspaceInput`) og bygger **`triPaneMountProps`** via **`buildContentWorkspaceTriPaneShellMountPropsFromWorkspaceBundle`** inne i shell.
- **Editor2-mount:** fjern **`editor2MountProps`** + løs **`editor2Model`** fra parent; **kun** **`editor2MountInput`** (`ContentWorkspaceEditor2MountInput`) med **samme** props-assembly som tidligere i **`buildContentWorkspaceEditor2ShellMountProps`** (lokal i `ContentWorkspacePageEditorShell.tsx`).
- **Linjebudsjett:** `ContentWorkspace.tsx` under **2200** linjer uten whitespace-/EOL-triks — **supplert** med ren flytting av **`runAiSuggest`** til **`useContentWorkspaceRunAiSuggest`** i eksisterende **`useContentWorkspaceAi.ts`** (identisk logikk).

### Ikke mål

- **Ingen** endring i **`blocksForLivePreview`-kjede**, **`visualInlineEditApi`**, **`blockInspectorCtx`** (bygges uendret i `ContentWorkspace.tsx`).
- **Ingen** ny forretningslogikk; **ingen** nye barrel-/helper-filer.
- **Ingen** dobbel import av **`ContentWorkspaceTriPaneMount`**; parent importerer ikke **`buildContentWorkspaceTriPaneShellMountPropsFromWorkspaceBundle`**.

### Linjetall (PowerShell `(Get-Content …).Count`)

| Fil | Før repair (baseline denne runden) | Etter |
|-----|-------------------------------------|-------|
| `ContentWorkspace.tsx` | **2326** | **2190** |
| `ContentWorkspacePageEditorShell.tsx` | (varierende) | **204** |

### Kommandoer (verifisert 2026-03-28)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` (gjenværende risiko ved minne) |

### Preview-paritet (FASE 32 REPAIR)

**Uendret:** `blocksForLivePreview`, `visualInlineEditApi`, `blockInspectorCtx` — samme **useMemo** / hook-kilder i **`ContentWorkspace.tsx`**; **`ContentWorkspacePageEditorShell`** er **kun** presentasjon + tri-pane/Editor2 **mount-props-assembly** fra navngitte inputs.

---

## FASE 33 baseline for semantic page-editor input assembly reduction

**Dato:** 2026-03-28 (lokal verifisering).

| Fil | Linjetall (`(Get-Content …).Count`) | Git-status (før FASE 33-staging) |
|-----|-------------------------------------|-----------------------------------|
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | **2190** | **M** |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspacePageEditorShell.tsx` | **204** | sporet |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceTriPaneShellBundle.ts` | **74** | sporet |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceModalShellSlices.ts` | **22** | sporet |
| `app/(backoffice)/backoffice/content/_components/useContentWorkspaceAi.ts` | **1237** | **M** (ikke endret i FASE 33) |

### Gjenværende semantic page-editor input assembly-monolitt før FASE 33

I **`ContentWorkspace.tsx`** (før uttrekk):

- **`triPaneBundleInput`:** `frame` + `chrome` (shared/editor/main/properties/tri-tupler) + `auxiliary` med `identity` / `detail` / `save` / `pageBody` / `aiPitch` (`buildAuxiliaryShellAiPitchFromFields(…)`).
- **`editor2MountInput`:** alle Editor2-mount-felter inline.
- **Design/global:** `designTail`, `globalMainView`, `globalMainViewCont`, `globalBranchProps`, `conflictShellProps` som nested JSX-objekter.
- **Modal:** `buildContentWorkspaceModalShellPropsFromWorkspaceFlatFields` uendret i denne runden (ingen egen modal-input-fil — ikke stor nok egen klump vs. shell).

---

## 2026-03-28 — FASE 33: `contentWorkspacePageEditorShellInput.ts` + støtteflyttinger

### Mål

- **Én ny modul** `contentWorkspacePageEditorShellInput.ts` eier **`buildContentWorkspacePageEditorShellBundle`**: flat **`ContentWorkspacePageEditorShellBundleFields`** → `designTail` / global / konflikt / `editor2MountInput` / `triPaneBundleInput` (samme innhold og rekkefølge som tidligere JSX).
- **Parent** kaller **`{...buildContentWorkspacePageEditorShellBundle({ … })}`** — ikke lenger stor nested `triPaneBundleInput`/`editor2MountInput`/design-global JSX i **ContentWorkspace.tsx**.
- **Støtte (eksisterende filer, ingen nye hooks):** `applyBlockImagePick` / `duplicateBlockInWorkspaceList` / `createRichTextBlockFromLegacyText` i **`contentWorkspace.blocks.ts`**; **`fetchBuildHomeFromRepoIntent`** i **`forsideUtils.ts`**; **`buildOutboxExportSnapshot`** + **`copyOutboxSafetyExportToClipboard`** i **`contentWorkspace.outbox.ts`**; **`runWorkspaceAiImageBatch`** i **`contentWorkspace.aiRequests.ts`** (samme HTTP/ sideeffekter som tidligere `runAiImageBatch` i parent — linjebudsjett &lt; 2000).

### Linjetall etter

| Fil | Linjer |
|-----|--------|
| `ContentWorkspace.tsx` | **1986** |
| `contentWorkspacePageEditorShellInput.ts` | **253** |
| `contentWorkspace.blocks.ts` | **714** |
| `forsideUtils.ts` | **63** |
| `contentWorkspace.outbox.ts` | **204** |
| `contentWorkspace.aiRequests.ts` | **323** |

### Kommandoer (verifisert 2026-03-28)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende warnings) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS med `NODE_OPTIONS=--max-old-space-size=8192` (gjenværende risiko ved minne) |

### Preview-paritet (FASE 33)

**Uendret:** `blocksForLivePreview`, `visualInlineEditApi`, `blockInspectorCtx` — samme **useMemo** / hooks i **`ContentWorkspace.tsx`**; nye moduler er **kun** input-assembly / transport / imperative helpers — **ingen** alternativ preview-render-logikk.
