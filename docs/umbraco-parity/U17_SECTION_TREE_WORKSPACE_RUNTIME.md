# U17 — Section / tree / workspace (runtime)

## Modell

- **Section** → `sectionId` + `BACKOFFICE_NAV_GROUP_LABEL`.
- **Tree/collection** → `collectionKey` på manifest-rad.
- **Workspace** → `href`, `kind`, `id`.

## Navigasjon

- TopBar: `isBackofficeNavActive` (prefix).
- Dyp rute: `findBackofficeExtensionForPathname` (lengste match).

## Nye ruter

- Legg **kun** inn rader i `BACKOFFICE_EXTENSION_REGISTRY` (én sann liste).
