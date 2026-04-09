# CP2 — CMS control surface deepening

**Dato:** 2026-03-29

## Implementert

- **TopBar**: nye faner **Runtime** (`/backoffice/runtime`) og **Uke & meny** (`/backoffice/week-menu`) — samme chrome, phase2a-DNA.
- **Runtime-side**: read-only aggregater (firma per status, lokasjoner, aktive avtaler) + operative tårn-lenker.
- **Uke & meny-side**: Sanity `menu` lest via `getMenusByMealTypes`, forklaring av `GET /api/week`, lenke til Sanity Studio, skille mot redaksjonell `weekPlan`.
- **Control-siden**: peker til runtime + uke/meny.
- **Eksisterende** `CmsRuntimeStatusStrip` beholdt (CP1).

## Ikke gjort (med vilje)

- Ny shell, ingen duplikat navigasjonsrot.
- Ingen mutasjon av runtime-tabeller fra disse sidene.

## Måloppnåelse

Backoffice oppleves mer som **én kontrollflate** med **handlingsdyktige** innganger (navigasjon + lesing + Studio) uten å duplisere database-sannhet.
