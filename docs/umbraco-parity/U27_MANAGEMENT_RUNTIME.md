# U27 — Management runtime (levert)

## Endepunkt

- `GET /api/backoffice/content/governance-usage`  
  - **Rolle:** superadmin  
  - **Kontrakt:** `jsonOk` med aggregerte felt (se route + `contentGovernanceUsage.ts`)

## UI

- `/backoffice/settings/governance-insights` — read-only management-lignende visning.

## Forhold til U26

- `GET /api/backoffice/content/governance-registry` — statisk code registry.
- U27 — **bruksdata** fra faktiske varianter; komplementært, ikke duplikat.

## Ikke levert

- CRUD på document types via API.
- Egen persisted «usage»-tabell.
