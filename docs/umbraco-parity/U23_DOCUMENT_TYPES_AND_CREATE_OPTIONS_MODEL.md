# U23 — Document types og create options

## Document type-lignende modeller i dag

| Konsept | Kilde | Merknad |
|--------|--------|--------|
| Document type alias | `documentTypes.ts` | `page` |
| Allowed children | `DocumentTypeEntry.allowedChildren` | Kun `page` under `page` |
| Envelope | `bodyEnvelope.ts` | `documentType` + `fields` + `blocksBody` i DB/API |
| Page kind / forside | `forsideUtils.ts`, workspace state | Redaksjonell, ikke egen document type-tabell |

## Create options i praksis

1. **Tre / side**: `ContentWorkspaceCreatePanel` — modus «velg type» → skjema (tittel/slug). `allowedChildTypes` fra forelder; tom liste = ingen opprettelse under node uten konfigurasjon.
2. **Blokker**: `BlockAddModal` — liste over **editor block types** med beskrivelse; `onAdd(type)` — ikke samme konsept som document type, men **entity create option**-lignende UX.

## Umbraco-speiling (mål for Lunchportalen)

| Umbraco 17 | Lunchportalen (dagens stack) |
|------------|------------------------------|
| Document type | `DocumentTypeEntry[]` + envelope `documentType` |
| Entity create option action | Create panel + BlockAddModal entries |
| Create dialog | Eksisterende modaler — U23: tydeligere tekst og lenke til forklaringsflate |

## Kan bygges nå uten ny sannhetsmodell
- Lesbar **oversikt** over document types og create surfaces.
- Forbedret **copy** i create panel (hva som er tillatt hvor).
- **Ingen** persisted document type editor uten backend — **REPLATFORMING_GAP** hvis krav om CRUD på typer i database.

## Må vente
- Redigerbare document types / compositions / templates som i Umbraco backoffice.
- Server-side **allowed document type sets** utover dagens felt — krever produkt/API-beslutning.
