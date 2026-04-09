# U25 — Create wizard and filters model

## Create options in practice today

1. **Choose mode** (`ContentWorkspaceCreatePanel` `mode === "choose"`): lists `allowedChildTypes` from parent context; each maps to `getDocType` for label.
2. **Form mode:** title/slug + submit via `submitCreateContentPageFromForm` → `POST /api/backoffice/content/pages`.
3. **Document type alias** (`createDocumentTypeAlias`): when user picks a type in wizard, client sends `serializeBodyEnvelope({ documentType, fields: {}, blocksBody: { version:1, blocks:[] } })` in JSON **body** field.

## Umbraco parity mapping (conceptual)

| Umbraco | Lunchportalen |
|---------|----------------|
| Entity Create Option Action | Choose buttons → `onModeForm(alias)` |
| Create dialog | Form mode panel |
| Content type filters | `allowedChildTypes` + block allowlist |
| Allowed child types | `contentDocumentTypes.allowedChildren` + API-derived list |

## Buildable now (no policy engine)

- Clarify wizard steps in UI copy (Settings + panel).
- **U25:** Server accepts and validates optional `body` on POST; default envelope if omitted.

## Must wait

- Persisted “blueprints” / templates per document type.
- Dynamic allowed children from DB.
