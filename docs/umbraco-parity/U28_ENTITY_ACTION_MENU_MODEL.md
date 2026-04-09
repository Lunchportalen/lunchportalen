# U28 — Entity action menu model

## Flater og handlinger

| Flate | Kilde | Handlinger |
|-------|-------|------------|
| Trees | `NodeActionsMenu` | Kontekstmeny: CRUD-lignende, preview, lenke |
| Discovery | `BackofficeCommandPalette` | Enter → `router.push(href)` |
| Workspace | `ContentWorkspace` | Lagre, forhåndsvis, blokker, AI |
| Collections | Vekst, tabeller | Editor-lenke, U28: delt `entityAction`-stil |
| Domain/tårn | Vekst m.fl. | Samme pink-underline mønster |

## Konsistent vs tilfeldig

- **Konsistent:** pink underline + `font-semibold` for «åpne/rediger» i collections.
- **Tilfeldig:** discovery har ikke overflow-meny — kun navigasjon (OK for Umbraco-lignende palette).

## Umbraco-konsept (speilet i Next)

- **Entity action:** én handling på én entitet (eller meny med flere).
- **Entity bulk action:** valgte rader + én handling (clipboard / reviewbar batch).
- **Collection action:** toolbar-nivå (søk, filter, bulk-rad).

## Bygges nå (U28)

- `components/backoffice/backofficeEntityActionStyles.ts` — én sannhet for primær-/sekundær-lenke i backoffice entity-rader.
- Eksisterende menyer refaktoreres minimalt (import av klasser der det er lav risiko).

## Må vente

- Dynamisk manifest for handlinger (REPLATFORMING_GAP).
- Server-side bulk utenfor `previewNormalizeLegacyBodyToEnvelope`-kontrakten.
