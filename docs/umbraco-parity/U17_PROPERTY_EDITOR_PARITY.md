# U17 — Workspace + property editor parity

**Arbeidsstrøm 3** — mål: tydeligere document-type / property-editor-opplevelse.

## Eksisterende byggesteiner

- **Page kinds / blocks:** `editorBlockTypes.ts`, `blockFieldSchemas.ts`, `SchemaDrivenBlockForm`.
- **Design scopes:** dokumentert i CP10/CP11 document-type kart.
- **Metadata / SEO / CRO:** paneler i content workspace (`ContentSeoPanel`, `ContentCroPanel`, …).
- **Validering:** `blockValidation.ts`, `useBlockValidation.ts`.

## Redaktørfortelling (må være tydelig)

1. **Hva slags innhold** — block type + label (`blockLabels.ts`).
2. **Styrende felt** — schema + inspector.
3. **Publish-kritiske felt** — merkes i UX over tid; U17 krever ikke ny datastruktur.
4. **Runtime-koblede felt** — kun visning/lenke til runtime — **ikke** dupliser ordre/agreement-sannhet.

## Ikke gjort

- Ingen parallell editor.
- Ingen ny `document type` database — **konseptuell** paritet via eksisterende typer og paneler.

## Referanse

- `CP11_DOCUMENT_TYPE_PROPERTY_EDITOR_RUNTIME.md`
- `CP12_DOCUMENT_TYPE_PARITY_RUNTIME.md`
