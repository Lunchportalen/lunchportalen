# U30X — Changed files

## Kode

| Fil | Hvorfor | Risiko |
|-----|---------|--------|
| `lib/cms/treeRouteSchema.ts` | Klassifisere degradérbare schema-feil | Lav — kun brukt av tree route |
| `app/api/backoffice/content/tree/route.ts` | Degradering, `degraded`-flag, korrekt table vs column | Lav — superadmin-only; tester dekker |
| `lib/cms/auditLogTableError.ts` | Bedre «unavailable» for audit | Lav |
| `app/(backoffice)/.../mapTreeApiRoots.ts` | `parseTreeFetchEnvelope` | Lav |
| `app/(backoffice)/.../ContentTree.tsx` | Varsler fra API | Lav |
| `ContentWorkspaceShell.tsx` | Bredere tre-kolonne, klarere header | Lav UI |
| `ContentWorkspaceWorkspaceShell.tsx` | Tri-pane proporsjoner | Lav UI |
| `ContentWorkspaceMainCanvas.tsx` | Større preview-split | Lav UI |
| `LivePreviewPanel.tsx` | Større preview, mindre støy | Lav UI |
| `RightPanel.tsx` | «Inspektør» | Lav UI |
| `components/backoffice/BackofficeExtensionContextStrip.tsx` | Tettere kontekst | Lav UI |
| `app/(backoffice)/backoffice/settings/document-types/page.tsx` | Collection → workspace: breadcrumb + snarvei til innhold | Lav UI |
| `tests/cms/treeRouteSchema.test.ts` | Ny | Ingen |
| `tests/cms/mapTreeApiRoots.test.ts` | Utvidet | Ingen |
| `tests/api/treeRouteDegradable.test.ts` | Ny | Ingen |

## Dokumentasjon

- Nye `docs/umbraco-parity/U30X_*.md` (denne leveransen).

## Sletting

- Ingen markdown-filer slettet (trygghet + revisjonsspor).
