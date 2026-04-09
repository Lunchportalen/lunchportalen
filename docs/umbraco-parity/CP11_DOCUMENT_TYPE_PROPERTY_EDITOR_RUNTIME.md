# CP11 — Document type / property editor runtime

**Dato:** 2026-03-29

## Kart (konsept → implementasjon)

| Umbraco | Lunchportalen |
|---------|----------------|
| Document type | Page kind + metadata + `editorBlockTypes` |
| Property editor | `SchemaDrivenBlockForm`, per-block editors |
| Tabs | Content sidepaneler |

## Hva CP11 gjør (UX)

- **Workspace-header** tydeliggjør *hva slags arbeidsflate* dette er (media vs SEO vs domene).
- **Ingen** ny block-schema-motor.

## Hva som forblir UX-paritet

- Document type **arv** og **composition** som i Umbraco — krever egen arkitektur / replatforming-diskusjon.

## Grenser

- **Ingen** duplikat av `block.config`.
- **Ingen** ny CMS-sannhet for agreement/week/menu.
