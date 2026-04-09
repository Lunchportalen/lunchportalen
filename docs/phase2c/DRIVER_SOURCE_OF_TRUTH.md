# Driver — source of truth (2C3)

## Lesing

| Sannhet | Kilde |
|---------|--------|
| Stopp-liste per dato | `orders` aggregert i `GET /api/driver/stops` |
| «Levert»-flagg | `delivery_confirmations` (nøkkel: dato + slot + company_id + location_id) |
| Firma/lokasjon-metadata | `companies`, `company_locations` |
| Ordre-rader | `orders` med filtre som i API |

## Skriving

| Handling | API | Persistens |
|----------|-----|------------|
| Markér levert (stopp) | `POST /api/driver/confirm` | `delivery_confirmations` upsert |
| Sjåfør kun **i dag** (Oslo) | Validering i `confirm` og `stops` | — |

## Ingen ny sannhet i 2C3

- Ingen parallell leveransetabell eller duplikat ordrelogikk.
- Ingen endring i `middleware`, `post-login`, `getAuthContext`, employee order/window, billing.

## Konvolutt

- Suksess: `{ ok: true, rid, data }` — UI **må** tolerere jsonOk (normaliseres i `normalizeStopsResponse`).
