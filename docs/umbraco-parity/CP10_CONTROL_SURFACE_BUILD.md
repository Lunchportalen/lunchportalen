# CP10 — Control surface build (WS2)

## Mål

Sterkere **følelse av ett samlet CMS** uten ny shell ved siden av eksisterende backoffice.

## Levert i CP10

- **Nav-konsistens:** TopBar og palett deler `BACKOFFICE_NAV_ITEMS`.
- **TopBar:** `min-w-0 flex-1 overflow-x-auto` for lesbar navigasjon på smale skjermer (ingen ny modul).

## Videre (ikke obligatorisk CP10)

- **Gruppering** av faner i seksjoner — produktbeslutning; ikke implementert for å unngå stor layout-refaktor.

## Grenser

- Ingen **ny** `BackofficeShell`-erstatning.
- Ingen endring av **runtime** sannhet for domener.
