# U30X-READ-R2 — Blocks, modals & schema map

## Subsystem-tabell

| Subsystem | Files | What it controls | Data source | UI responsibility | Governance relevance | Problems |
|-----------|-------|-------------------|-------------|-------------------|------------------------|----------|
| **Block registry** | `blockRegistry.ts` (BLOCK_REGISTRY), `contentWorkspace.blockRegistry.ts` | Tilgjengelige typer, metadata | Statisk registry + imports | Etiketter, ikoner | Kobles til allowlist via `allowedBlockTypeKeys` | Må holdes synk med `blockFieldSchemas` og server-validering |
| **Field schema** | `blockFieldSchemas.ts` | Per-type felt, grupper, defaults | Kode (ikke DB) | `SchemaDrivenBlockForm` / editor felt | Definerer “property editor”-lignende UI | Én sannhet i kode — ikke Umbraco data type store |
| **Add flow (modal)** | `BlockAddModal.tsx`, `ContentWorkspaceModalStack.tsx` | Velg type → legg til | Klient-state | Modal | Filtreres av `isBlockTypeAllowedForDocumentType` + picker context | To innganger: modal vs `BlockPickerOverlay` — må ikke divergere i tillatelser |
| **Pick flow (overlay)** | `BlockPickerOverlay.tsx` | Overlay med søk, favoritter, nylig | `localStorage` + `BLOCK_REGISTRY` | Fullskjerm/portal overlay | `context.allowedBlockTypeKeys` | Avhengig av klient-lagring for UX — ikke server-sannhet |
| **Edit flow** | `BlockEditModal.tsx`, `SchemaDrivenBlockForm.tsx` | Rediger blokk | Klient draft → `editModalLiveBlock` for live preview | Modal | Validering `blockValidation.ts` | “Live preview” uten lagre kan forvirre vs lagret tilstand |
| **Duplicate** | `contentWorkspace.blocks.ts` (`duplicateBlockInWorkspaceList`) | Kopier blokk i liste | Klient | Liste/canvas | Nye ID | Må holde konsistens med reorder |
| **Reorder** | `useContentWorkspaceBlocks.ts`, dnd-kit i `ContentWorkspace.tsx` | Rekkefølge | Klient → PATCH body | Canvas | Ingen separat “structure API” | Store PATCH — konflikt/versjon må håndteres i persistence |
| **Schema (document)** | `lib/cms/contentDocumentTypes.ts`, `documentTypes.ts` | `allowedBlockTypes` per doc | Kode | Create panel / picker | **Kun `page` alias** i lib — begrenset | Ikke full Umbraco document type matrix |
| **Envelope / body** | `bodyEnvelope.ts`, `bodyParse.ts` | JSON-konvolutt + blocks | `content_page_variants.body` | Modus “blocks” vs legacy tekst | `legacyEnvelopeGovernance.ts` | Legacy vs envelope drift — governance-usage API overvåker |
| **AI block builder** | `app/api/backoffice/ai/block-builder/route.ts`, `useContentWorkspaceAi.ts` | Forslag til blokker | OpenAI + sidekontekst | AI-panel | Kan foreslå typer — må enforced på save | Avhengig av capability + sikker filtrering |

## BlockBuilder / BlockEditor “liknende”

| Navn i repo | Rolle | Status |
|-------------|-------|--------|
| `app/api/backoffice/ai/block-builder/route.ts` | Server-side AI som returnerer blokk-forslag | **ACTIVE** |
| `editors/HeroBlockEditor.tsx`, `ImageBlockEditor.tsx`, … | Per-type redigerings-UI | **ACTIVE** |
| `Editor2Shell` i `_stubs.ts` | Placeholder | **STUB** — `null` |

## Modaler — oversikt

| Modal | Fil | Åpnes fra |
|-------|-----|-----------|
| Block add | `BlockAddModal.tsx` | `ContentWorkspaceModalStack` |
| Block edit | `BlockEditModal.tsx` | Samme |
| Block picker overlay | `BlockPickerOverlay.tsx` | Samme |
| Media | `MediaPickerModal.tsx` | `_stubs` re-export |
| AI full page | `ContentWorkspaceAiFullPageModal.tsx` | Workspace |
| Internal link | `InternalLinkPickerModal.tsx` | Rich/lenker |

**Merk:** `ContentWorkspaceModalStack.tsx` importerer fra `./_stubs` — filen **er ikke** “stub-modaler”; den re-eksporterer ekte implementasjoner (`_stubs.ts` kommentar forklarer Editor2 som eneste placeholder).

## Preview / inspector coupling

- **Inspector:** `ContentWorkspacePropertiesRail.tsx` + `BlockInspectorFields.tsx` — redigerer valgt blokk / sidefelter.
- **Preview:** `LivePreviewPanel` / `ContentWorkspacePreviewPane` — mottar display-blocks inkl. WOW før/etter og `editModalLiveBlock` for “live” modal-preview.
- **Risiko:** Samtidig “modal draft” og “saved blocks” — krever klar visuell/tekstlig tilstand (kode har eksplisitt `editModalLiveBlock` state).

## Design / global / page

- **Design tail:** `ContentWorkspaceDesignTailShell.tsx` — faner og farge-kontinuitet.
- **Global navigation shell:** `ContentWorkspaceGlobalNavigationShellPanelsCont.tsx`, `ContentWorkspaceGlobalMainViewShell.tsx` — presentasjon av global workspace.
- **Document type på create:** `createDocumentTypeAlias`, `allowedChildTypes` state i `ContentWorkspace.tsx` — **Core Patch A** kommentarer; data hentes når create panel åpnes.

## Anbefalt neste leserekkefølge (blokker)

1. `blockFieldSchemas.ts` + `blockValidation.ts`  
2. `useContentWorkspaceBlocks.ts` + `contentWorkspace.blocks.ts`  
3. `BlockPickerOverlay.tsx` + `BlockAddModal.tsx`  
4. `blockAllowlistGovernance.ts` + `contentDocumentTypes.ts`
