# U25 — Envelope adoption baseline

**Status:** Baseline snapshot before/around U25 implementation. **Code wins** if this doc drifts.

## Canonical body envelope

- **Contract:** `lib/cms/bodyEnvelopeContract.ts` — `parseBodyEnvelope` / `serializeBodyEnvelope`.
- **Shape:** `{ documentType, fields, blocksBody }` where `blocksBody` is typically `{ version, blocks }` or legacy string parsed downstream.

## What already saved with canonical envelope (pre–U25 drift)

- Any page whose variant `body` includes `documentType` and nested `blocksBody` / blocks — **editor save path** via `useContentWorkspaceBlocks` → `serializeBodyEnvelope` when `documentTypeAlias` is set (`contentWorkspace.blocks.ts` / `useContentWorkspaceBlocks.ts`).
- **PATCH** `app/api/backoffice/content/pages/[id]/route.ts` persists whatever the client sends; allowlist validation runs when envelope has `documentType` (`validateBodyPayloadBlockAllowlist`).

## Legacy / flat body

- Stored shape `{ version, blocks }` **without** top-level `documentType` — treated as legacy; **server allowlist skipped** (`blockAllowlistGovernance.ts`).
- String body or malformed JSON — legacy paths in `parseBodyEnvelope`.

## Create/save flows and `documentType`

| Flow | Set `documentType`? | Notes |
|------|---------------------|--------|
| Editor save with DT selected | Yes | Envelope serialized |
| Editor save with «no document type» | No | Flat blocks payload |
| **POST create (before U25)** | **No** — variant inserted `BODY_BASELINE` flat `{ version, blocks }` | Gap |
| **POST create (U25)** | **Yes** — default `page` + empty blocks in envelope | Fixed |
| Create panel + form with chosen alias | Client could send `body` in JSON; **server ignored body pre-U25** | Fixed: server merges/validates optional `body` |

## What U25 makes first-order for governance

- **New pages** always persist a **canonical envelope** by default (`documentType: "page"`, empty blocks), unless client supplies a valid envelope (wizard).
- **UI honesty:** `ContentMainShell` shows legacy vs canonical envelope messaging.
- **No mass migration** of old rows in U25 — existing flat bodies remain until edited/saved with DT or a dedicated migration phase.
