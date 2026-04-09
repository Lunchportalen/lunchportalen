# CP13 — Section, tree & workspace model

## Seksjoner i dag (LP)

Mappes til `BackofficeNavGroupId` / `sectionId`:

| Section (visningsnavn) | id |
|------------------------|-----|
| Kontroll & sikkerhet | `control` |
| Enterprise & runtime | `runtime` |
| Domene & drift | `domain` |
| Innhold & vekst | `content` |
| Brukere & system | `system` |

## Trees / collections

- **Content tree:** `/backoffice/content` — `collectionKey: contentTree`.
- **Media:** `collectionKey: media`.
- **Week/menu:** `collectionKey: weekMenu` — koblet til `domainSurfaceId: week_menu`.
- **Domener/kunder/avtale:** egne `collectionKey` (`domains`, `customers`, `agreement`).

## Workspaces

Hver primær rute med `kind: "workspace"` eller `surface` er et **workspace entry point** med stabil `extensionId` (f.eks. `nav.week-menu`).

## entityType-lignende kobling

- **`collectionKey`** + **`domainSurfaceId`** gir eksplisitt kobling uten ny database.
- Ekstern **entity** (company, page, menu) forblir i **runtime eller Sanity/Postgres** — manifestet peker, eier ikke data.

## Standardisering: section → collection → workspace

1. `sectionId` grupperer i TopBar/palett (som Umbraco sections).
2. `collectionKey` identifiserer tree/workspace-familie.
3. `href` er **én** canonical workspace-URL.

## Stack uten parallelle systemer

- Én **`BACKOFFICE_EXTENSION_REGISTRY`** — ingen `navItems.v2`.
- Eksisterende **BackofficeShell** + **BackofficeWorkspaceSurface** uendret i ansvar.

## Replatforming-gap

- Ekte Umbraco **tree API** med server-side noder — **ikke** duplisert; LP bruker Next-ruter + eksisterende data-API.
