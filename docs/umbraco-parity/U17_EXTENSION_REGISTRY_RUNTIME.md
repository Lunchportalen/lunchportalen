# U17 — Extension registry (runtime)

**Bygger på:** CP13 `lib/cms/backofficeExtensionRegistry.ts` — **ingen** parallell liste.

## U17 DEEP tillegg

- **`findBackofficeExtensionForPathname(pathname)`** — matcher **lengste** `href` først slik at under-ruter (f.eks. `/backoffice/content/recycle-bin`) får riktig manifest (`discovery.recycle-bin`), ikke foreldre-`nav.content`.

## Kilder for TopBar / palett / kontekst

- `BACKOFFICE_NAV_ITEMS`, `BACKOFFICE_PALETTE_ITEMS` — uendret offentlig API (via `backofficeNavItems.ts` barrel).
- **Context strip** bruker samme manifest + `moduleLivePosture` + `controlPlaneDomainActionSurfaces`.

## Contextual actions

- Første rad i `domain.actions` vises som hurtiglenke når `domainSurfaceId` er satt — **ikke** ny action-motor.
