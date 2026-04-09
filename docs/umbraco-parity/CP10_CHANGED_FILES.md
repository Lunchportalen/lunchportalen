# CP10 — Changed files

## Kode

| Fil | Hvorfor | Minimal risiko |
|-----|---------|----------------|
| `lib/cms/backofficeNavItems.ts` | Én kilde for TopBar + palett; `filterBackofficeNavItems` for klientfiltrering | Kun statiske ruter; ingen auth/API |
| `components/backoffice/BackofficeCommandPalette.tsx` | CP10 global ⌘K/⌘K navigasjon til eksisterende `/backoffice/*` | `router.push` + tastatur; ingen mutasjon |
| `app/(backoffice)/backoffice/_shell/TopBar.tsx` | Bruker `BACKOFFICE_NAV_ITEMS`; nav scroll på smal skjerm | Samme aktive-rute-logikk som før |
| `app/(backoffice)/backoffice/_shell/BackofficeShell.tsx` | Monterer `BackofficeCommandPalette` | Kun client child |
| `tests/cms/backofficeCommandPalette.test.ts` | Tester for `filterBackofficeNavItems` | Regresjon |

## Dokumentasjon

- `docs/umbraco-parity/CP10_*.md` (denne fasen).

## Ikke endret

- Middleware, auth, `POST/GET` ordre/billing, Supabase-schema, onboarding, employee Week, kitchen/driver runtime.
