# Company admin — Ansatte og lokasjoner (2C1)

## Ansatte

- **Canonical liste:** `/admin/users` — henter `GET /api/admin/users` (server fetch med cookie).
- **Rolle:** kun `company_admin` på siden; andre roller redirectes (eksisterende logikk).
- **Mutasjoner:** deaktivering/reaktivering følger eksisterende API der det finnes — **ingen ny modell**.

## Lokasjoner

- **`/admin/locations`** — `loadAdminContext` + `LocationsPanel`; bruker eksisterende `app/api/admin/locations`-flyt.
- **Delete/edit:** følger eksisterende backend og panel — ikke endret i 2C1 utover navigasjon/IA.

## Tester

- `tests/tenant-isolation-admin-people.test.ts` — beholdt relevant for tenant.
