# U30X-READ-R2 — Editor file & component map

**Klassifisering:** ACTIVE | SUPPORTING | TRANSITIONAL | LEGACY | BROKEN | UNCLEAR

## Nav / registry

| Område | Fil/mappe | Rolle | Status | Hvorfor viktig | Prioritet |
|--------|-----------|-------|--------|----------------|-----------|
| Extension manifest | `lib/cms/backofficeExtensionRegistry.ts` | TopBar + palett + settings path | **ACTIVE** | Én registry for navigasjon | P1 ved IA-endring |
| Legacy nav | `lib/cms/backofficeNavItems.ts` | Eldre liste | **TRANSITIONAL / SUPPORTING** | Kan overlappe CP13 | P2 konsolidering |

## Shell / layout

| Område | Fil/mappe | Rolle | Status | Hvorfor viktig | Prioritet |
|--------|-----------|-------|--------|----------------|-----------|
| Backoffice shell | `backoffice/_shell/BackofficeShell.tsx` | 100vh, TopBar, palette | **ACTIVE** | Root for all backoffice | P0 |
| TopBar | `backoffice/_shell/TopBar.tsx` | Primær nav | **ACTIVE** | IA | P0 |
| Section | `backoffice/_shell/SectionShell.tsx` | Tre + main grid | **ACTIVE** | Layout-sannhet | P0 |
| Content layout | `content/layout.tsx` | MainView + workspace layout | **ACTIVE** | Editor wrapper | P0 |
| Workspace layout | `content/_workspace/ContentWorkspaceLayout.tsx` | Tre + route children vs editor | **ACTIVE** | Selection vs dashboard | P0 |

## Content workspace

| Område | Fil/mappe | Rolle | Status | Hvorfor viktig | Prioritet |
|--------|-----------|-------|--------|----------------|-----------|
| Core | `content/_components/ContentWorkspace.tsx` | Hovedstate | **ACTIVE** | Største overflate | P0 |
| Composition | `ContentWorkspaceFinalComposition.tsx` | Sammensetning | **ACTIVE** | Render-splitting | P1 |
| Hooks | `useContentWorkspace*.ts` (mange) | Data, blocks, AI, UI | **ACTIVE** | Adskilt logikk | P1 |
| State | `ContentWorkspaceState.ts` | Typer | **ACTIVE** | Kontrakt | P1 |
| Legacy sidebar | `ContentWorkspaceLegacySidebar.tsx` | Eldre rail | **TRANSITIONAL** | `embedded` skjuler delvis | P2 |

## Preview

| Område | Fil/mappe | Rolle | Status | Prioritet |
|--------|-----------|-------|--------|-----------|
| Live preview | `LivePreviewPanel.tsx`, `ContentWorkspacePreviewPane.tsx` | Forhåndsvisning | **ACTIVE** | P0 |
| Public preview route | `backoffice/preview/[id]/page.tsx` | Ekstern preview | **ACTIVE** | P1 |

## Inspector / properties

| Område | Fil/mappe | Rolle | Status | Prioritet |
|--------|-----------|-------|--------|-----------|
| Rail | `ContentWorkspacePropertiesRail.tsx` | Høyre inspector | **ACTIVE** | P0 |
| Card | `ContentWorkspacePropertiesInspectorCard.tsx` | Del-inspeksjon | **ACTIVE** | P1 |
| Block fields | `BlockInspectorFields.tsx` | Felt-mapping | **ACTIVE** | P1 |

## Tree

| Område | Fil/mappe | Rolle | Status | Prioritet |
|--------|-----------|-------|--------|-----------|
| Tree | `content/_tree/ContentTree.tsx` | API + navigasjon | **ACTIVE** | P0 |
| Move | `ContentTreeMoveDialog.tsx` | DnD/move | **ACTIVE** | P1 |
| Mock/helpers | `treeMock.ts`, `mapTreeApiRoots.ts` | Parse + filter | **ACTIVE** | P1 |

## Audit / history

| Område | Fil/mappe | Rolle | Status | Prioritet |
|--------|-----------|-------|--------|-----------|
| API | `app/api/backoffice/content/audit-log/route.ts` | Leselog | **ACTIVE** (degraderbar) | P0 robusthet |
| UI | Paneler knyttet til historikk (se `ContentPageVersionHistory`, composition) | Tidslinje | **ACTIVE / delvis** | P1 |

## Settings

| Område | Fil/mappe | Rolle | Status | Prioritet |
|--------|-----------|-------|--------|-----------|
| Settings layout | `backoffice/settings/layout.tsx` | Seksjon | **ACTIVE** | P1 |
| Document types | `settings/document-types/**` | UI | **ACTIVE** | P1 |
| Data types | `settings/data-types/**` | UI | **ACTIVE** | P1 |
| Schema | `settings/schema/page.tsx` | Oversikt | **ACTIVE** | P2 |
| Create policy/options | `settings/create-policy`, `create-options` | Policy UI | **ACTIVE** | P1 |

## Governance

| Område | Fil/mappe | Rolle | Status | Prioritet |
|--------|-----------|-------|--------|-----------|
| Allowlist | `lib/cms/blockAllowlistGovernance.ts` | Blokk vs doc type | **ACTIVE** | P0 |
| Usage API | `app/api/backoffice/content/governance-usage/route.ts` | Scan | **ACTIVE** | P1 |
| Envelope | `bodyEnvelopeContract.ts`, `legacyEnvelopeGovernance.ts` | Legacy vs envelope | **ACTIVE** | P0 |

## AI

| Område | Fil/mappe | Rolle | Status | Prioritet |
|--------|-----------|-------|--------|-----------|
| AI hooks | `useContentWorkspaceAi.ts`, `contentWorkspace.aiRequests.ts` | Orkestrering | **ACTIVE** | P1 |
| API | `app/api/backoffice/ai/**` | Mange endepunkter | **ACTIVE** (varierende modenhet) | P1 |

## Media

| Område | Fil/mappe | Rolle | Status | Prioritet |
|--------|-----------|-------|--------|-----------|
| Picker | `MediaPickerModal.tsx` | Liste/filtrering | **ACTIVE** | P1 |
| API | `app/api/backoffice/media/**` | items, upload | **ACTIVE** | P1 |

## Week / menu

| Område | Fil/mappe | Rolle | Status | Prioritet |
|--------|-----------|-------|--------|-----------|
| `lib/cms/weekPlan.ts`, `operationalWeekMenuPublishChain.ts` | Orkestrering | **ACTIVE** (editorial vs operativ grense) | P2 — ikke bland runtime |
| Studio | `studio/**` | Sanity | **SUPPORTING / LIMITED** | P2 |

## Document type / data type / create flow

| Område | Fil/mappe | Rolle | Status | Prioritet |
|--------|-----------|-------|--------|-----------|
| `lib/cms/contentDocumentTypes.ts` | Minimal `page` type | **ACTIVE** men **tynn** | P0 utvide med reell modell |
| `documentTypes.ts` (app) | Editor-kopi | **ACTIVE** | P1 |
| Create submit | `contentWorkspaceCreatePageSubmit.ts` | POST pages | **ACTIVE** | P0 |

## Discovery / timeline / management read

| Område | Fil/mappe | Rolle | Status | Prioritet |
|--------|-----------|-------|--------|-----------|
| `lib/cms/backofficeDiscoveryIndex.ts`, `backofficeDiscoveryEntities.ts` | Indekser | **ACTIVE** | P2 |
| `components/cms/control-plane/CmsHistoryDiscoveryStrip.tsx` | Layout-strip | **ACTIVE** | P2 |

## Dashboard vs editor

| `content/page.tsx` | **GrowthDashboard** | Vekst/analyse — **ikke** klassisk CMS-landing | **ACTIVE** | **P0 IA-beslutning** — brukere kan misforstå “Content” root |
