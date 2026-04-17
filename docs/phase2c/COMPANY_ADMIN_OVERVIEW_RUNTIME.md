# Company admin — Oversikt / KPI (2C1)

## Datakilde

- **`loadAdminContext`** (`lib/admin/loadAdminContext.ts`) — tenant `profiles.company_id` + service-role-tellinger.
- Samme ukevindu for «bestillinger denne uken» som **`GET /api/admin/dashboard`** (`startOfWeekISO` → `weekEnd` eksklusiv).

## Tall som vises (ekte)

| KPI | Kilde |
|-----|--------|
| Ansatte (totalt / aktive / deaktivert) | `profiles` med `role = employee`, `disabled_at` |
| Lokasjoner | `company_locations` for `company_id` |
| Bestillinger i dag | `orders` `date = Oslo i dag`, `status = ACTIVE` |
| Bestillinger denne uken | `orders` innen ukevindu, `ACTIVE` |
| Firma/avtalestatus | `companies.status` (som før) |

### Firmastatus (company_admin)

- Oversikten viser **lesbar** firmastatus (operativ sannhet).
- **company_admin** muterer ikke `companies.status`; skrivebane er **superadmin** (`/api/superadmin/companies/set-status`).

## Tall som ikke vises som «økonomisk sannhet»

- Ingen **beløps-KPI** på oversikten — fakturaøkonomi er **CSV-eksport** og eventuelt innsikt-sider, ikke aggregert omsetning på dashboard uten eksplisitt API.

## Varsler

- Pending invitasjoner: eksisterende `PendingInvitesStat`.
- Aktivitetsfeed: fortsatt **tom placeholder** inntil egen hendelseskø er koblet (ærlig tekst i UI).
