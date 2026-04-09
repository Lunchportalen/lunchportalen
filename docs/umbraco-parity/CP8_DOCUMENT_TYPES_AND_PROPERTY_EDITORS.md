# CP8 — Document types og property editors (på dagens stack)

## Mapping til Umbraco-begreper

| Umbraco | Lunchportalen (faktisk) |
|---------|-------------------------|
| Document type | **Page kind** (`lib/cms` / page metadata) + Sanity `_type` for meny-dokumenter |
| Data type | **Felt-typer** i `blockFieldSchemas` / schema-drevet skjema |
| Property editor | **Blokk-editorer** + `SchemaDrivenBlockForm` / dedikerte editor-komponenter |
| Template | **Variant** + Next-render + design scopes |

## Hva som kan løftes uten parallelle systemer

- **Mer eksplisitte labels** i workspace: «Innholdstype», «Publiseringskritiske felt», «Kun visning» (copy/UX).
- **Seksjonsgruppering** i eksisterende paneler (ingen ny editor).
- **Design scopes** som tydelig «presentation»-lag i kontrollplan-språk.

## Hva som er UX-paritet vs teknisk likhet

- **UX:** Redaktør får forståelse av *type*, *feltrolle*, *publisering* — som Umbraco.
- **Teknisk:** Ingen migrering til én Umbraco schema-definisjon.
