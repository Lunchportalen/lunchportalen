# U28 — Management usage runtime model

## Eksisterende flater

- Settings hub, schema, create-options, management-read (U23/U26).
- `GET /api/backoffice/content/governance-usage` (U27) — legacy vs governed, `byDocumentType`, `blockTypeCounts`.

## U28 utvidelser

- **Governance coverage:** antall varianter der `documentType` er satt og allowlist **OK** vs **feiler** vs **ukjent dokumenttype**.
- Samme read-only modell — ingen ny tabell.

## Mangler fortsatt (ærlig)

- Preset per property-editor i DB — fortsatt code-first; «preset usage» kartlegges via dokumenterte defaults i `U28_PROPERTY_PRESET_USAGE_MODEL.md`.

## Management API-paritet

- HTTP read-endepunkter som returnerer `jsonOk` — ikke Umbraco Management CRUD.
