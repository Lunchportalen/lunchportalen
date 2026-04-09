# U29 — Document type collection model

- **Collection:** tabell med alias, navn, barn, blokkpolicy, lenke til workspace.
- **Workspace:** `/settings/document-types/[alias]` — read-only detalj fra `getDocType` + governance-tabell.
- **Sannhet:** `lib/cms/contentDocumentTypes.ts` — ingen ny database.
