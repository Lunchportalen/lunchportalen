# U18 — Global discovery model

## Eksisterende mekanismer

| Mekanisme | Beskrivelse |
|-----------|-------------|
| Command palette | Filtrert liste, grupper etter `sectionId` |
| Extension registry | Alle `href` med `surface.palette` |
| Historikk-strip | Lenker til riktig kilde per domene |

## Redaktør-gap (adressert i U18)

- Vanskelig å finne **tårn** uten å kjenne URL.
- Norske/engelske synonymer (**uke**, **tårn**, **innhold**) ga ikke treff.

## Umbraco «quick find»-paritet uten indeks

- Utvidet **søkeblob** per manifest-rad: `label`, `href`, `collectionKey`, `id`, `discoveryAliases`.
- **Samme** `filterBackofficeNavItems` API — konsumenter uendret.

## Må vente (replatforming eller produkt)

- **Elasticsearch/Algolia**-lignende fulltext — egen plattformbeslutning.
