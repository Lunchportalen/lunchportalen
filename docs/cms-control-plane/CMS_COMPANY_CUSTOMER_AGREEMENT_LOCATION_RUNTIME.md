# CMS — Company / customer / agreement / location runtime (CP2)

**Dato:** 2026-03-29

## Kilde

- `loadControlPlaneRuntimeSnapshot` → `companies.status`, `company_locations` count, `company_current_agreement` ACTIVE count.
- Superadmin gate via `isSuperadminProfile` + `supabaseAdmin()`.

## Hva brukeren får

- **Én side** (`/backoffice/runtime`) med tall som speiler operativ database — ikke CMS-tekst.
- **Lenker** til superadmin/admin/kitchen/driver for faktiske operasjoner.

## Grense

- **Ingen** POST/PUT fra backoffice-runtime-siden til `companies` eller avtaler — full samsvar med CP2_COMPANY_AGREEMENT_LOCATION_LINKAGE.md.
