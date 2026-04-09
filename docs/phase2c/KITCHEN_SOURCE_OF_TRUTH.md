# Kitchen — source of truth (2C2)

## Ordre og produksjon

| Sannhet | System | Merknad |
|---------|--------|---------|
| **Aktive ordre per dato** | `orders` med `status` ∈ `ACTIVE`/`active`, filtrert på kjøkken-scope (`company_id` + `location_id` for kjøkkenrolle) | `GET /api/kitchen` |
| **Linjevis meny/valg** | `day_choices` + avtale/meny (`agreement_json`, CMS-meny) | Samme route |
| **Aggregert produksjonsbilde (vindu, Basis/Luxus, hierarki)** | `lib/kitchen/report` → `GET /api/kitchen/report` | `KitchenView` |

## Firma og lokasjon

- **`companies`** — visningsnavn.  
- **`company_locations`** — visningsnavn.  
- **`profiles`** — ansattnavn/avdeling.

## Hva som ikke er ny sannhet i 2C2

- Ingen nye tabeller, ingen parallell ordre-/faktura-/billing-pipeline.  
- Ingen endring i `middleware`, `post-login`, eller employee order/window.

## Klient-konvolutt

- Alle API-responser følger `{ ok, rid, data }` ved suksess.  
- **Kritisk:** UI som leser `/api/kitchen` må pakke ut `data` — implementert i `lib/kitchen/kitchenFetch.ts` (tidligere feil: hel konvolutt ble lest som flat payload og ga tom liste).
