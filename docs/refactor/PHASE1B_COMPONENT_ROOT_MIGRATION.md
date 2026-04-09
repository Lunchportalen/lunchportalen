# Phase 1B — `src/components` som kanonisk rot

## tsconfig

`tsconfig.json` paths:

```json
"@/components/*": ["./src/components/*", "./components/*"]
```

**`src/components` har prioritet** — imports med `@/components/...` løses dit først.

## Første migreringsslice (utført)

Flyttet til `src/components/nav/`:

- `HeaderShellView.tsx`
- `NavActiveClient.tsx`
- `AuthSlot.tsx`

`components/nav/*.tsx` er **tynne re-exports** til `../../src/components/nav/...` for eventuelle relative imports / verktøy som ikke bruker alias.

### Allerede i `src/components`

- `src/components/nav/HeaderShell.tsx` (server shell)
- `src/components/registration/RoleGate.tsx`

## Gjenstår før `components/` kan markeres deprecated

- Flytte `components/auth/LogoutClient.tsx`, `components/layout/*`, `components/week/*`, `components/ui/*` etter samme mønster.
- Søk etter direkte filstier til `components/` (uten `@/`) og oppdater eller behold re-export-lag.

## Ingen oppførsel-endring

Kun filplassering + re-exports; importene bruker fortsatt `@/components/...`.
