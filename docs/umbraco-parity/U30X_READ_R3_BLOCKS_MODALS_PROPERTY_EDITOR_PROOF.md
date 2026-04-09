# U30X-READ-R3 — Blocks, modals, property editor proof

## Subsystem-tabell

| Subsystem | Files | What it controls | Data source | UI responsibility | Governance relevance | Parity class | Problems |
|-----------|-------|------------------|-------------|-------------------|------------------------|--------------|----------|
| Block add | `BlockAddModal.tsx` (re-export `_stubs.ts`), `ContentWorkspaceModalStack.tsx` | Åpne/lukke, `onAdd(type)` | Allowed keys fra governance | Modal | `isBlockTypeAllowedForDocumentType` (`blockAllowlistGovernance.ts`) | **PARTIAL** | Ikke PE package |
| Block pick | `BlockPickerOverlay.tsx` | Overlay pick | `blockRegistry` / definitions | Overlay | allowlist filter | **PARTIAL** | |
| Block edit | `BlockEditModal.tsx` | Feltredigering | Block instance JSON | Modal + `SchemaDrivenBlockForm` | validering | **UX_PARITY_ONLY** | Live draft i `ContentWorkspace` state |
| Reorder | `@dnd-kit`, `useContentWorkspaceBlocks` | Rekkefølge | Lokal state → persist | Canvas | — | **PARTIAL** | |
| Duplicate | `duplicateBlockInWorkspaceList` (`contentWorkspace.blocks.ts`) | Kopi | State | — | — | **CODE_GOVERNED** | |
| Block schema | `blockFieldSchemas.ts`, `editorBlockTypes.ts` | Felttyper | **Kode** | Skjemagenerering | — | **STRUCTURAL_GAP** vs Umbraco data types | Ikke DB |
| Document type ↔ blocks | `contentDocumentTypes.ts` (lib), `documentTypes.ts` i app, `blockAllowlistGovernance.ts` | Tillatte typer | TS registry | Create flow | **CODE_GOVERNED** | **PARTIAL** | Minimal `page` doc type i lib export |
| Body envelope | `bodyEnvelopeContract.ts`, `bodyEnvelope.ts` (components) | Serialisering | Variant body JSON | Parse/serialize | `legacyEnvelopeGovernance.ts` | **PARTIAL** | |
| Preview coupling | `ContentWorkspacePreviewPane`, `LivePreviewPanel.tsx` | Forhåndsvisning | Draft state | iframe/preview | — | **PARTIAL** | |
| Inspector | `BlockInspectorShell.tsx`, `ContentWorkspacePropertiesRail.tsx` | Høyre rail | Selected block/page | Form grupper | — | **UX_PARITY_ONLY** | |

## Schema vs configured instance vs UI vs preset

| Lag | LP implementasjon | Umbraco 17 referanse |
|-----|-------------------|----------------------|
| Schema | `blockFieldSchemas.ts` + TS typer | **property editor schema** — **PARTIAL** (ikke server datatype) |
| Instance | JSON i `content_page_variants` body | **PROPERTY VALUE** — **RUNTIME_TRUTH** (Postgres) |
| UI | Per-block editors under `editors/` | **property editor UI** — **UX_PARITY_ONLY** |
| Preset | Outbox, image presets, AI-generated drafts | **property value preset** — **PARTIAL** / **STUB** der ikke persistert |

## Modal UX — risikoobservasjoner (kode)

- `ContentWorkspaceModalStack` kombinerer **full-page AI**, **block add**, **picker overlay**, **edit**, **media** — høy **modal surface area** → Bellissima «calm workspace» **UX_PARITY_ONLY**; risiko for **DEGRADED** opplevd fokus (uten screenshots: **ikke verifisert visuelt**).

## Sluttdom

**PARTIAL** samlet: sterk **CODE_GOVERNED** blokk-pipeline, men **STRUCTURAL_GAP** mot Umbraco **data type / property editor** som administrerbare server-entiteter.
