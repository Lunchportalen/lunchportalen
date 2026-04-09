# U23 — Changed files

## Kode

| Fil | Hvorfor | Minimal risiko |
|-----|---------|----------------|
| `lib/cms/contentDocumentTypes.ts` | Ny kanonisk kilde for document types | Lav — samme data som tidligere `documentTypes.ts` |
| `app/(backoffice)/backoffice/content/_components/documentTypes.ts` | Re-export fra lib | Lav — stabil API for app-importer |
| `lib/cms/editorBlockCreateOptions.ts` | Én liste for blokk-create (modal + Settings) | Lav — fjerner duplikat |
| `lib/cms/backofficeSchemaSettingsModel.ts` | Governance-modell for schema-side | Lav — read-only hjelpedata |
| `app/(backoffice)/backoffice/content/_components/BlockAddModal.tsx` | Bruker `EDITOR_BLOCK_CREATE_OPTIONS` | Lav — samme innhold |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceCreatePanel.tsx` | Tekstfiks dokumenttype-knapper | Lav — copy only |
| `app/(backoffice)/backoffice/settings/page.tsx` | Settings-hub (U23) | Lav — ny landing |
| `app/(backoffice)/backoffice/settings/system/page.tsx` | Flyttet systeminnstillinger | Lav — samme logikk som tidligere rot |
| `app/(backoffice)/backoffice/settings/schema/page.tsx` | Read-only schema governance | Lav — ingen mutasjon |
| `app/(backoffice)/backoffice/settings/create-options/page.tsx` | Create flow forklaring | Lav |
| `lib/cms/backofficeExtensionRegistry.ts` | `discoveryAliases` for Settings | Lav |
| `tests/backoffice/documentTypes.test.ts` | Import fra lib | Lav |
| `tests/cms/backofficeSchemaSettingsModel.test.ts` | Ny enhetstest | Lav |

## Dokumentasjon

- `docs/umbraco-parity/U23_*.md` (baseline, runtime, beslutning, matrix, signoff, risks, next steps, execution log, changed files).
