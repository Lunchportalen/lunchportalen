# U23 — Data types og property presets

## Data type-lignende modeller i dag

| Lag | Hvor | Innhold |
|-----|------|--------|
| **Property editor schema** (felt-kontrakt) | `blockFieldSchemas.ts` | `EditorFieldKind`, `EditorBlockFieldSchema`, grupper, `defaultValues`, `requiredKeys` |
| **Configured instance** | Blokk `data` + `config` i JSON | Per-blokk verdier og layout-hints |
| **Property editor UI** | `SchemaDrivenBlockForm`, `FieldRenderer` | Rendring etter kind |
| **Presets** | `defaultValues`, design card presets (`designContract`), `BLOCK_CARD_PRESETS` | «Scaffolding» av tom blokk |

## Page-level metadata
- SEO/metadata-paneler, design scopes — styres av workspace-komponenter og kontrakter, ikke én «data type»-entitet.

## Umbraco-speiling

| Umbraco | Lunchportalen |
|---------|----------------|
| Data type | Konfigurerbar **instans** — her: per blokktype layout + defaults i kode |
| Property editor schema | `EditorBlockFieldSchema` + validering |
| Property editor UI | felt-kinds → komponenter |
| Property value preset | `defaultValues` / presets i `blockFieldSchemas` og design-lag |

## Kan bygges nå
- **Read-only katalog** som lister `EditorFieldKind` → betydning (tekst, media, lenke, …) og peker til schema-fil.
- Utdyping i **U23 schema**-flate sammen med `PropertyDatasetExplainer` (U22).

## UX-paritet vs teknisk likhet
- Ekte Umbraco **data type CRUD** og **JSON Schema** i database = replatforming eller større backend — se `U23_REPLATFORMING_GAPS.md`.
