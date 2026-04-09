# U25 — Block allowlist runtime

## Server

- **PATCH** `[id]`: `validateBodyPayloadBlockAllowlist` (unchanged U24).
- **POST** create: same validator for optional initial body.

## Client

- Add block / picker: existing filters.
- **U25 duplicate:** `onDuplicateBlock` checks `isBlockTypeAllowedForDocumentType` and blocks with warning toast if not allowed.

## Not claimed

- AI-generated block injection without save — still ends at PATCH; no separate AI allowlist endpoint added in U25.
