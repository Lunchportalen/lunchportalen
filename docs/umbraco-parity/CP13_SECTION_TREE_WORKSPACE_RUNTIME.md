# CP13 — Section / tree / workspace (runtime)

## Runtime-atferd

- Seksjoner = `sectionId` på hver `BackofficeExtensionEntry`.
- Tree/collection = `collectionKey` (dokumentasjon + fremtidig telemetri).
- Workspace entry = `href` + `id` + `kind`.

## Navigasjon

- TopBar itererer `BACKOFFICE_NAV_ITEMS` (avledet fra registry).
- Aktiv tilstand: **`isBackofficeNavActive`** — erstatter manuell per-route logikk.

## Nye ruter

- Legg alltid inn nye backoffice-moduler i **`BACKOFFICE_EXTENSION_REGISTRY`** (én rad), ikke i isolerte arrays.
