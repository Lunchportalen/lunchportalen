# Company admin — IA og navigasjon (2C1)

## Canonical surface

- **`/admin`** er hovedinngang (Oversikt / kontrolltårn-KPI).
- **Én navigasjon:** `app/admin/AdminNav.tsx` — vist for **`company_admin` kun** (superadmin som åpner `/admin` får ikke denne nav-baren, for å unngå «feil kontekst»).

## Grense mot superadmin (Closeout 4B)

Firmaadmin er **rammeflate for ett firma** (Supabase-operativ sannhet). **Ikke** her: firmastatuspause/lukking, avtalegodkjenning eller tverrfirma — det er **superadmin**-ansvar. UI og `loadAdminContext` skal ikke fremstille `/admin` som system- eller overrideflate.

## Lenker (samlet)

| Label | Rute | Merknad |
|-------|------|---------|
| Oversikt | `/admin` | KPI + snarveier |
| Ansatte | `/admin/users` | Eksisterende liste-API |
| Lokasjoner | `/admin/locations` | `LocationsPanel` |
| Avtale | `/admin/agreement` | GET `/api/admin/agreement` |
| Økonomi | `/admin/insights` | Innsikt/metrikk (lesing) |
| Faktura (CSV) | `/api/admin/invoices/csv` | Eksisterende eksport — ikke ny motor |
| Historikk | `/admin/orders` | Ordrehistorikk |
| Aktivitet | `/admin/history` | Aktivitet/historikk-side |
| Kontrolltårn | `/admin/control-tower` | Supply chain tower |

## Ikke deprecate

Eksisterende sider (`/admin/people`, `/admin/employees`, `/admin/ansatte`, osv.) er **ikke** slettet; **kanonisk inngang** for «Ansatte» er `/admin/users` i nav for å unngå tre mentale modeller. `people` kan lenkes internt senere hvis produkt ønsker én liste.

## Snarveier på oversikt (sekundære)

Hurtiglenker i sidepanel: Invitasjoner, Menyer, Bærekraft, Revisjon — unngår duplikat av hovednav.
