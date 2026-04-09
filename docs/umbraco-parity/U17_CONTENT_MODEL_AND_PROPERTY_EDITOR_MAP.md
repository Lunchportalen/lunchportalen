# U17 — Content model & property editor map

## Kart

| Umbraco-lignende | Kilde i repo |
|------------------|---------------|
| Document type | Page kind + variant + `editorBlockTypes` / `blockFieldSchemas` |
| Data type | Felt-typer i `blockFieldSchemas`, design scopes (`lib/cms/design/`) |
| Property editor | `SchemaDrivenBlockForm`, `editors/*BlockEditor.tsx` |
| Tabs / groups | Inspector / side panels i content workspace |

## Løft uten ny sannhetsmotor

- **Publish-kritiske felt** — merkes i validering og ev. UI-hints (iterativt).
- **Runtime-koblede felt** — forklares i panel eller strip (`runtimeLinked` i `BackofficeWorkspaceSession` type).

## UX-paritet vs teknisk likhet

- Umbraco lagrer **Data Type** som entiteter — LP bruker **TypeScript** og delt schema — **bevisst**.
- Full parity krever enten **replatforming** eller vedvarende **schema-disiplin** (anbefalt på dagens stack).

## Repo-nøkler

- `blockFieldSchemas.ts`, `editorBlockTypes.ts`, `ContentSeoPanel`, `ContentCroPanel`, `SchemaDrivenBlockForm`.
