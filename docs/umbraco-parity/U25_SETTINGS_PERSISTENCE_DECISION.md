# U25 — Settings persistence decision

## Safe existing storage

- **`system_settings`** (and related) — operational toggles; used for **runtime/system** posture, not arbitrary CMS schema CRUD (see `settings/system`).

## U25 decision

| Concern | Persistence |
|---------|-------------|
| Document types / allowed blocks | **Code registry** — `lib/cms/contentDocumentTypes.ts` |
| Data type / field kinds | **Code** — schema settings model + `blockFieldSchemas` |
| Create options | **Code** — `editorBlockCreateOptions` + workspace logic |
| New page default envelope | **Written with page variant** — not a separate settings row |

## Honest UI

- Settings pages state clearly: **read-only governance from code**; no fake “save document type” that does not exist in API.
- If a future phase adds Supabase-backed type definitions, that would be a **new contract** — out of scope for U25.

## What must not be pretended

- Full Umbraco **persisted** document type / data type CRUD without schema migration and API — **not shipped** in U25.
