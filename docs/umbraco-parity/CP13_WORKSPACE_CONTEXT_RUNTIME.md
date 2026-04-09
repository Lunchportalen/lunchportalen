# CP13 — Workspace context (runtime)

## Type-fil

- **`lib/cms/backofficeWorkspaceContextModel.ts`**
  - `BackofficeWorkspaceSession` — `extensionId`, `workspaceId`, `collectionKey`, `lifecycle`, `runtimeLinked`.

## Bruk (valgfritt per side)

- Send som props eller `data-*` attributter der det gir verdi — **ikke** påkrevd globalt i CP13.

## Content apps

- Uendret: eksisterende paneler i content workspace (`ContentSidePanel`, osv.).

## Mangler (bevisst)

- Global React Context for workspace — **ikke** introdusert (unngår duplikat state med eksisterende hooks).
