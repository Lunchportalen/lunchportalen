# CP13 — Property editor & data type model (baseline)

## Kartlegging fra eksisterende kode

| Umbraco-lignende konsept | Lunchportalen i dag |
|--------------------------|------------------------|
| Document type | Page kind + variant + `editorBlockTypes` |
| Data type | `blockFieldSchemas`, design scopes, metadata-typer |
| Property editor | `SchemaDrivenBlockForm`, dedikerte `*BlockEditor` |
| Tabs / content apps | Content workspace paneler |

## Løft uten ny sannhetsmodell

- Merke **publish-kritiske** felt i schema/metadata (UX — allerede delvis i `blockValidation`).
- **`runtimeLinked`** i workspace-session der felt speiler API/Sanity (forklaring, ikke ny DB).

## UX-paritet vs teknisk likhet

- Full Umbraco **Data Type**-entitet i DB — **replatforming-gap**; LP bruker TypeScript-schema.
- **Opplevelse** av «riktig editor for riktig type» — oppnås ved å holde block-schema og paneler konsistente (CP11-sporet).

## Replatforming-gap

- Innføring av **JSON Schema** generert fra CMS for alle property editors — valgfritt; ikke CP13-krav.
