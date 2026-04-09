# U25 — Document type enforcement rollout

## What is description-only today

- **Document type registry** text in Settings UI (`backoffice/settings/schema`) — read-only mirror of `lib/cms/contentDocumentTypes.ts`.
- **Allowed child types** for create under parent — depends on parent fetch + `getDocType`; if parent has no DT, UX shows empty allowed list (informational).

## What is actually enforced

| Surface | Enforcement |
|---------|-------------|
| **Save (PATCH)** | `validateBodyPayloadBlockAllowlist` when envelope has `documentType` |
| **Create (POST) U25** | Optional `body` validated; default envelope `page` + empty blocks |
| **Add block** | Client: `isBlockTypeAllowedForDocumentType` in `useContentWorkspaceBlocks.onAddBlock` + modals (`contentWorkspaceModalShellProps`) |
| **Block picker** | Filtered by effective allowlist |
| **Duplicate block U25** | Client guard + toast if type not allowed for current DT |

## Rollout strategy (safe)

1. **Create:** Server default envelope — new rows enter governed world without DB migration.
2. **Edit:** User selects DT in editor; first save upgrades payload to envelope (existing behaviour).
3. **Duplicate:** Block duplicate cannot inflate forbidden types when DT is set.
4. **AI apply:** No change in U25 unless existing apply path already merges blocks — still subject to PATCH validation on save.

## Without new truth model

- Single registry: `contentDocumentTypes.ts` + `editorBlockCreateOptions.ts`.
- No per-tenant persisted document type store.

## Wait for later

- DB-backed document types (Umbraco Management API parity).
- Server-side duplicate/AI intermediate validation beyond save — optional hardening once product demands it.
