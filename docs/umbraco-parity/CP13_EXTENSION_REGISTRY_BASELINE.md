# CP13 — Extension registry baseline

## Hva som i dag tilsvarer et registry/manifest-lag (før CP13)

- **`BACKOFFICE_NAV_ITEMS` + `BACKOFFICE_PALETTE_ITEMS`** i `lib/cms/backofficeNavItems.ts` — flat liste med `groupId` (seksjon), men **uten** stabile extension-id, `kind`, eller kobling til CP4/CP6.
- **`MODULE_LIVE_POSTURE_REGISTRY`** (`lib/cms/moduleLivePosture.ts`) — modulposture, separat fra nav.
- **`CONTROL_PLANE_DOMAIN_ACTION_SURFACES`** (`lib/cms/controlPlaneDomainActionSurfaces.ts`) — domene-overflater, separat fra nav.
- **Blokk-/plugin-registry** (`lib/cms/blocks/registryManifest.ts`, `plugins/registry.ts`) — innholdsdomene, ikke hele backoffice.

## Hva som var hardkodet eller spredt

- TopBar hadde **per-route** aktive-tilstand (lang `if`-kjede) duplisert med nav-href-regler.
- Discovery-extras (`BACKOFFICE_DISCOVERY_EXTRAS`) var et **sekundært** array som måtte merges manuelt.

## Hva CP13 samler i ett kanonisk registry

- **`lib/cms/backofficeExtensionRegistry.ts`** — `BACKOFFICE_EXTENSION_REGISTRY` med:
  - stabil **`id`**
  - **`kind`**: `workspace` | `surface` | `tool`
  - **`sectionId`** (Bellissima section-bucket)
  - **`collectionKey`** (tree/workspace-paritet)
  - valgfri **`domainSurfaceId`** og **`modulePostureId`** (kobler til eksisterende CP4–CP6 uten duplikat sannhet)
  - **`surface.topBar` / `surface.palette`**
- Avledede **`BACKOFFICE_NAV_ITEMS`** og **`BACKOFFICE_PALETTE_ITEMS`** fra samme liste.
- **`backofficeNavItems.ts`** er **kun barrel** for bakoverkompatibilitet.

## Hva som fortsatt ligger ved siden av (transitional)

- **Workspace React Context** — ikke globalt påkrevd; type-modell i `backofficeWorkspaceContextModel.ts` for gradvis innføring.
- **Full Umbraco extension JSON manifest** — ikke serialisert til fil; **kode er source of truth** (samsvar med prosjektregel).

## Hva som må konsolideres fremover (ikke parallelt system)

- Flater som fortsatt hardkoder lenker utenfor registry bør flyttes inn i manifest ved touch.
- Property editor / data type kart (**CP11**) forblir komplementært — se `CP13_PROPERTY_EDITOR_AND_DATA_TYPE_MODEL.md`.
