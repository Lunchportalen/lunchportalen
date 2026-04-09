# U24 — Document type runtime

## Kilde

- `lib/cms/contentDocumentTypes.ts` — `DocumentTypeEntry.allowedBlockTypes` (git-persistert registry).
- `lib/cms/blockAllowlistGovernance.ts` — `getEffectiveAllowedBlockTypeKeys`, `validateBodyPayloadBlockAllowlist`.

## Håndheving

- **API**: `PATCH /api/backoffice/content/pages/[id]` avviser (422) ukjent `documentType` eller ulovlige `block.type` når envelope er brukt.
- **Klient**: `documentTypeAlias` → `BlockAddModal`, `BlockPickerOverlay`, `onAddBlock` / picker `onPick`.

## Legacy

- Body **uten** `documentType` (flat `version`+`blocks`): ingen allowlist-sjekk — migrer til envelope for streng styring.
