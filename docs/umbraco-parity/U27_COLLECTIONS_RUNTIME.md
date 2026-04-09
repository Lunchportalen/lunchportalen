# U27 — Collections runtime (levert)

## Prinsipp

Collections er **kontrollplan**, ikke ny sannhetsmotor. Bulk uten trygg backend er utelatt.

## Implementert / forsterket

- **Vekst (Growth dashboard):** `BackofficeCollectionToolbar` med `bulkActions` — velg alle (filtrert), fjern valg, kopier editor-lenker for valgte sider. Ingen API-mutasjon.
- **Media:** Eksisterende trygge bulk-strenger og URL-kopiering uendret (se `backofficeCollectionViewModel.ts`).

## Ikke levert (bevisst)

- Ny collection-plattform.
- Server-side bulk PATCH/publish/slett.

## Neste mulige steg (utenfor U27-kjerne)

- Samme multi-select+mønster på andre tabeller **kun** når produkteier bekrefter trygg handling.
