# Umbraco parity — week runtime sync (WS3)

## Hva som synkroniseres automatisk

- Etter **vellykket Sanity publish** av `menuContent` vil **CDN/lesing** (Sanity read client) etter kort tid reflektere innhold i `getMenuForDates`/`GET /api/week` — samme filter som før.

## Hva som *ikke* er automatisk «sync» i LP

- **`menu_visibility_days`** (DB) brukes i superadmin menyoversikt — **separat** lag fra Sanity. Operativ ansatt-uke er **ikke** avhengig av denne tabellen for å lese `menuContent` (jf. `GET /api/week`).

## Drift

- Ved avvik: sjekk **Sanity** publisert dokument, deretter **avtale** (`delivery_days`), deretter **CDN/cache**-forsinkelse.

## Redaksjonell weekPlan

- Kan eksistere ved siden av — **skal ikke** presenteres som operativ bestillingskilde.
