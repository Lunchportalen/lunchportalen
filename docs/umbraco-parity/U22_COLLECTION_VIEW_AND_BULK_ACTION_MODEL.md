# U22 — Collection view og bulk action model

## Collections per domene

| Område | Collection view? | Merknad |
|--------|-------------------|---------|
| Content | Tre + vekst-lister | Ikke klassisk tabell for alle sider |
| Media | Grid | U22: toolbar + statusfilter + valg |
| Domener / kunder | Tabell | Server-render; filtrering kan utvides senere |
| Week/menu | Tabell + paneler | — |
| Growth | Lister i dashboard | U22: søk i «sider med poengsum» |
| Tårn | Lenker fra manifest | — |

## Trygge bulk-handlinger (uten ny sannhet)

- **Kopier URLer** for valgte media (kun utklippstavle).
- **Kopier tekst** / eksport som ikke muterer backend.

## Ikke i U22

- Bulk DELETE/PATCH media uten eksisterende batch-API — **REPLATFORMING_GAP** / fremtidig API.

## Umbraco-speiling (UX)

- `collection` + `collectionView` → én toolbar-komponent + filtrering.
- `entityBulkAction` → kun **safe** actions merket som kontrollplan.
