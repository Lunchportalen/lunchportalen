# U25 — Envelope runtime

## Server

- **`POST /api/backoffice/content/pages`**  
  - No `body`: inserts variant with `serializeBodyEnvelope({ documentType: "page", fields: {}, blocksBody: { version:1, blocks:[] } })`.  
  - With `body`: `parseBodyEnvelope` → normalize blocks → `getDocType` check → `validateBodyPayloadBlockAllowlist`.

## Client

- Load: `useContentWorkspaceData` / `parseBodyEnvelope` — unchanged.
- Save: existing envelope serialization when DT selected.

## Legacy

- Rows still flat `{ version, blocks }` until edited; UI warns in **Document Type** section.
