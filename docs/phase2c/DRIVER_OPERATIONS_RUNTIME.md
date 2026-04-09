# Driver — operative handlinger (2C3 runtime)

## Aktive (lav risiko, eksisterende backend)

| Handling | API | Merknad |
|----------|-----|---------|
| Hent stopp | `GET /api/driver/stops` | Lesing |
| Markér stopp levert | `POST /api/driver/confirm` med `date`, `slot`, `companyId`, `locationId` | Sjåfør: kun dagens dato; scope må matche profil |
| Last ned CSV per vindu | `GET /driver/csv?window=&date=` | Lesing; sjåfør kun i dag |
| Oppdater liste | Ny `GET` stops (knapp) | — |
| Utlogging | Supabase `signOut` + redirect | Eksisterende mønster |

## Bevisst utsatt / ikke i 2C3

| Ønske | Status |
|-------|--------|
| `bulk-set` i felt | `POST /api/driver/bulk-set` krever egen risikovurdering — **ikke** eksponert i denne flaten |
| Delvis levering / retur | Krever produkt-API |
| Navigasjon/kart tredjepart | Utenfor kjerne |

## Hva som må til før flere mutasjoner

1. Eksplisitt produktbeskrivelse per handling (idempotens, audit).
2. Tester for hver ny mutasjon.
3. Ingen overlapp med kitchen batch uten koordinert PR.
