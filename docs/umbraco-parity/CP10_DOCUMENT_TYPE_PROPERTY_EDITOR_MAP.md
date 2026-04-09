# CP10 — Document type / property editor map

**Dato:** 2026-03-29

## Hensikt

Løfte **page kinds**, **blocks**, **block.config**, **design scopes**, **metadata** og **paneler** til en **Umbraco-lignende opplevelse** uten å innføre Umbraco/.NET eller parallelle editorer.

## Kartlegging (konseptuelt)

| Umbraco-konsept | Lunchportalen i dag |
|-----------------|---------------------|
| Document type | Page kind + route metadata + layout hints |
| Block / grid | Block-typer + `editorBlockTypes` / skjemaer |
| Property editor | `SchemaDrivenBlockForm`, per-block editors |
| Tabs / groups | Content sidepaneler (SEO, CRO, info, AI) |
| Vary by culture | Delvis (språk/translation der implementert) |

## Hva som kan bygges på dagens stack

- **Tydeligere etiketter** for «hva slags innhold» (H1, kort beskrivelse, ikon) i workspace — **UX**, ikke ny DB.
- **Gruppering** av felt: «Publish-kritisk», «SEO», «Design», «Runtime-koblet (read-only)» — **presentasjon** av eksisterende felt.
- **Ikke** dupliser `block.config` i en annen tabell.

## Hva som må være UX-paritet, ikke teknisk likhet

- **Ekte** document-type arv og composition som i Umbraco — **krever** produktarkitektur utover CP10; dokumentert som **replatforming-gap** eller senere fase.
- **Universal block picker** med 100 % avanserte regler — iterativ.

## Grenser

- **Ingen** ny sannhetsmodell for agreement/week/menu.
- **Ingen** v2-editor ved siden av `ContentWorkspace`.
