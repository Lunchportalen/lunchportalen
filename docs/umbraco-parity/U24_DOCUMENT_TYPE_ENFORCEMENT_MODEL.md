# U24 — Document type enforcement

## Modell

| Lag | Umbraco-lignende | Lunchportalen U24 |
|-----|------------------|---------------------|
| Document type | Allowed compositions | `DocumentTypeEntry` + `allowedChildren` + **`allowedBlockTypes`** |
| Enforcement | Server + UI | `PATCH` body-validering + `BlockAddModal` / picker filter |

## Hva som fortsatt er kode-styrt (ikke DB)

- Endring av typer krever deploy/PR — **ærlig** i Settings-dokumentasjon (ingen late som Umbraco Management API).

## Kan bygges nå

- Ekstraksjon av blokker fra payload + sammenligning med allowlist.
- Avvisning med **422** og felt `forbidden` / `documentType`.

## Må vente

- Redigerbare document types i database uten replatforming — **REPLATFORMING_GAP**.
