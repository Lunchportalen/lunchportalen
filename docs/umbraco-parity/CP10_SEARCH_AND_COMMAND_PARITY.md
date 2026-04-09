# CP10 — Search and command parity (WS1)

## Mål

Lukke merkbare redaktør-gap i **hurtignavigasjon** og **filtrering** uten ny søkemotor.

## Implementert

- **`filterBackofficeNavItems`** + **`BackofficeCommandPalette`** (Ctrl+K / ⌘K).
- **En kilde** med `BACKOFFICE_NAV_ITEMS` delt med TopBar.

## Ikke i scope

- Server-side fulltext, felles indeks, søk i blokker fra global boks.

## Verifikasjon

- Manuelt: åpne backoffice, Ctrl+K, skriv «content», Enter → `/backoffice/content`.
- Automatisk: `tests/cms/backofficeCommandPalette.test.ts`.
