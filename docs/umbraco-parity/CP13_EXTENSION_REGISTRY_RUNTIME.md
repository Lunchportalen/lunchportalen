# CP13 — Extension registry (runtime)

## Kildefil

- **`lib/cms/backofficeExtensionRegistry.ts`** — kanonisk `BACKOFFICE_EXTENSION_REGISTRY`.

## Offentlig API

- `BACKOFFICE_EXTENSION_REGISTRY` — full manifest.
- `BACKOFFICE_NAV_ITEMS` — `surface.topBar === true`.
- `BACKOFFICE_PALETTE_ITEMS` — alle med `surface.palette`, deduplisert på `href`.
- `getBackofficeExtensionById` / `getBackofficeExtensionByHref`.
- `isBackofficeNavActive(href, pathname)` — prefix-match for aktiv fane.

## Konsumerere

- **`components/backoffice/BackofficeCommandPalette.tsx`** — uendret import fra `@/lib/cms/backofficeNavItems` (barrel).
- **`app/(backoffice)/backoffice/_shell/TopBar.tsx`** — bruker `isBackofficeNavActive`.

## Transitional

- Eldre dokumentasjon som nevner kun `backofficeNavItems` gjelder fortsatt — filen re-eksporterer registry.

## Ikke gjort

- Serialisert JSON-manifest til disk — **unødvendig**; kode er sannhet.
