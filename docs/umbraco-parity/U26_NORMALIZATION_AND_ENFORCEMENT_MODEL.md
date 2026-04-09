# U26 — Normalization and enforcement model

## Beskrivelse vs håndheving

- **Settings/schema-sider:** forklarer registry (kode).
- **PATCH save:** allowlist når envelope har `documentType`.
- **U26:** legacy→governed er **frivillig knapp** + toast; ingen batch-migrering.

## Flater

| Flate | Oppførsel |
|-------|-----------|
| Create | U25 default envelope |
| Oppgrader (U26) | `validateBlockTypesForDocumentTypeAlias` før `setDocumentTypeAlias` |
| Add/duplicate | Eksisterende U24/U25 |
| Save | Uendret server |
| AI apply | `validateEditorBlockTypesForGovernedApply` før `onApplySuggestPatch` |

## Uten ny sannhetsmodell

- `lib/cms/legacyEnvelopeGovernance.ts` + eksisterende allowlist.

## Venter

- DB-drevet document type store (replatforming).
