# Kitchen — produksjonsliste (2C2 runtime)

## Datakilde

- **`GET /api/kitchen?date=YYYY-MM-DD`** med enterprise-konvolutt `{ ok, rid, data }`.  
- Klienten **normaliserer** konvolutten via `lib/kitchen/kitchenFetch.ts` (`normalizeKitchenApiResponse`) slik at rader og `summary` alltid leses fra `data`.

## Hva listen viser (ekte felt)

| Signal | Kilde |
|--------|--------|
| Dato | Forespørsel + respons `data.date` |
| Firma | `companies.name` via ordre `company_id` |
| Lokasjon | `company_locations.name` via `location_id` |
| Ansatt | `profiles` (full_name / name / email) |
| Meny / måltid | `day_choices` + avtale/menyoppslag (`resolveMenuForDay`, `getMenusByMealTypes`) → `menu_title`, `menu_description`, `menu_allergens` |
| Notat | `orders.note` / relevant `day_choices.note` (som i API) |

## Tier (Basis/Luxus) på linjevis liste

- I **`/api/kitchen`** er `tier` i praksis **`null`** (kommentar i kode: kobles senere til avtale).  
- **Vises ikke** som pålitelig Basis/Luxus på linjen før API utvider feltet.  
- **Aggregert rapport** (`/api/kitchen/report`) viser fortsatt Basis/Luxus-aggregat per struktur der — det er separat visning.

## Filtrering og gruppering (kun klient)

- **Filter:** firma, lokasjon, meny/måltid (avledet av `menu_title` / fallback «Uten menyvalg»).  
- **Gruppering:** per firma, per lokasjon (`firma · lokasjon`), per meny/måltid, eller flat liste.  
- Tellekort (per firma / lokasjon / måltid) beregnes fra **filtrerte** rader — gir operativ «hva gjelder akkurat nå i filteret».

## Tom tilstand / helg

- API returnerer `reason`: `NOT_DELIVERY_DAY`, `NO_ORDERS`, osv. — vises uten å fabrikkere data.

## Eksport

- CSV og utskrift for **aggregert** rapport forblir på **Aggregert rapport**-fanen (`KitchenView`).
