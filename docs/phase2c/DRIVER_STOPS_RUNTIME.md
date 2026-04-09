# Driver — dagsliste / stopp (2C3 runtime)

## Datakilde

- **`GET /api/driver/stops?date=YYYY-MM-DD`** — jsonOk `{ date, stops[] }`.
- Klienten normaliserer respons via **`lib/driver/normalizeStopsResponse.ts`** (støtter konvolutt og eldre varianter).

## Felter per stopp (ekte)

| Felt | Merknad |
|------|---------|
| `slot` | Leveringsvindu (tekst fra ordre) |
| `companyName` / `locationName` | Fra `companies` / `company_locations` |
| `addressLine` | Sammensatt adresse fra lokasjon |
| `deliveryWhere`, `deliveryWhenNote` | Lokasjon / `delivery_json` |
| `deliveryWindowFrom` / `To` | Vist som tidsintervall |
| `deliveryContactName` / `Phone` | Kontakt på lokasjon |
| `orderCount` | Antall ordre aggregert til dette stopp-nøkkelen |
| `delivered`, `deliveredAt`, `deliveredBy` | Fra `delivery_confirmations` (upsert ved bekreftelse) |

## `deliveredBy`

- API lagrer `confirmed_by` (bruker-id). UI kan vise rå id der navn ikke er oppslått — **ikke** markedsført som «visningsnavn» før egen oppslag.

## Ordre som inngår

- Samme filter som API: `integrity_status = ok`, status ∈ `ACTIVE`, `QUEUED`, `PACKED`, `DELIVERED`, scope på `company_id` (+ `location_id` for sjåfør).

## Filtrering (kun klient)

- **Alle / Gjenstår / Levert** filtrerer listen før gruppering — påvirker ikke total-progress (som fortsatt er levert vs alle stopp).

## CSV

- **`/driver/csv?window=<slot>&date=`** — linjer per ordre i vinduet; sjåfør: kun `date = Oslo i dag`.
