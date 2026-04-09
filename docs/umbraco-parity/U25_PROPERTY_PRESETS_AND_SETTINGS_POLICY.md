# U25 — Property presets and settings policy

## What exists

- **Block field schemas:** `blockFieldSchemas.ts` + `SchemaDrivenBlockForm` — canonical per-block field definitions (implicit preset).
- **Editor create options:** `lib/cms/editorBlockCreateOptions.ts` — which block types appear in “add block”.
- **Design / meta:** `meta` on page (layout, toggles) — stored inside envelope `blocksBody` / editor state, not a separate property engine.

## Canonical vs implicit

| Area | Canonical surface | Implicit |
|------|-------------------|----------|
| Block fields | `blockFieldSchemas` | — |
| Document types | `contentDocumentTypes.ts` | — |
| Data type “kinds” | `getFieldKindGovernance()` in schema settings model | Some validation scattered |

## U25 stance

- **Lift UX:** Settings hub + schema page already explain code-governed registry; no new property engine.
- **Parity:** Umbraco “Property Value Preset” is simulated by **code defaults** + editor forms, not CRUD presets in DB.

## UX parity vs technical parity

- Editors see **honest** labels: definitions live in repo, not in a mutable admin database — acceptable parity on Next.js stack until replatforming.
