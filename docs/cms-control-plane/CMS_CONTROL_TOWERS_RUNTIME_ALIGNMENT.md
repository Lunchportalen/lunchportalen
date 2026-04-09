# CMS — Control towers runtime alignment (CP2)

**Dato:** 2026-03-29

## Tiltak

- **Runtime-siden** lenker eksplisitt til: superadmin (firma, system, faktura), **firma admin** `/admin/control-tower`, **kjøkken** `/kitchen`, **sjåfør** `/driver`.
- **Språk**: «Operativ sannhet» vs «kontrollplan» — konsistent med strip og CP1.

## Superadmin på `/admin`

- `app/admin/layout.tsx` tillater `superadmin` med nav skjult — lenke er gyldig for navigasjonsbro.

## Operativ sannhet

- Uendret: kitchen read-only, driver stops, admin scope — se AGENTS frosne regler.
