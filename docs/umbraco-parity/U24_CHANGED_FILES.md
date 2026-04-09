# U24 — Changed files

## Kode (hovedtrekk)

| Fil | Hvorfor |
|-----|---------|
| `lib/cms/extractBlocksSource.ts` | Delt blokk-ekstraksjon for parse + allowlist |
| `lib/cms/bodyEnvelopeContract.ts` | Kanonisk envelope for API + app (re-export fra app) |
| `app/.../bodyEnvelope.ts` | Re-export fra lib |
| `app/.../bodyParse.ts` | Bruker `extractBlocksSource` fra lib |
| `lib/cms/blockAllowlistGovernance.ts` | U24 — allowlist + validering |
| `lib/cms/contentDocumentTypes.ts` | `allowedBlockTypes` for `page` |
| `app/api/backoffice/content/pages/[id]/route.ts` | PATCH: 422 ved brudd |
| `BlockAddModal.tsx` | Filtrert liste |
| `BlockPickerOverlay.tsx` | Filtrert registry |
| `contentWorkspaceModalShellProps.ts` | `documentTypeAlias`, `allowedBlockTypeKeys` |
| `ContentWorkspaceModalStack.tsx` | Props til modal/overlay |
| `ContentWorkspace.tsx` | Sender `documentTypeAlias` |
| `contentWorkspaceModalShellArgs.ts` | Slice-type utvidet |
| `useContentWorkspaceBlocks.ts` | Guard på add |
| `settings/schema/page.tsx` | Kolonne tillatte blokker |
| `settings/create-options/page.tsx` | U24-sannhet |
| `tests/cms/blockAllowlistGovernance.test.ts` | Ny |
| `tests/backoffice/documentTypes.test.ts` | `allowedBlockTypes` |

## Dokumentasjon

- `docs/umbraco-parity/U24_*.md` (baseline, runtime, decision, matrix, signoff, risks, next steps, execution, changed files).
