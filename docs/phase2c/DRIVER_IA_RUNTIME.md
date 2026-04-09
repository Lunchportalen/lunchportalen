# Driver — informasjonsarkitektur (2C3 runtime)

## Kanonisk overflate

| Rute | Rolle | Formål |
|------|--------|--------|
| **`/driver`** | `driver`, `superadmin` (etter layout + side) | **Én** operativ leveringsflate: dagens stopp, status, bekreftelse, filter, CSV per vindu. |
| **`/driver/csv`** | `GET` med `window` + `date` | Read-only eksport (samme ordregrunnlag som stopp-listen; sjåfør kun **i dag**). |

## Samlet vs deprecate

| Før | Etter 2C3 |
|-----|-----------|
| Én side `DriverClient` uten eksplisitt «runtime»-navn i kode. | **`DriverRuntimeClient`** er kanonisk inngang fra `page.tsx` (tynn wrapper) — dokumentert samling uten duplikat flater. |
| Ingen filter for «gjenstår / levert». | **Filterchips** (Alle / Gjenstår / Levert) på samme liste. |
| CSV kun via direkte URL. | **«Last ned CSV»** per leveringsvindu i liste-header (lenke til `/driver/csv?...`). |

## Hva brukeren ser (minimum)

1. **Sticky topp:** dato (lang norsk), antall stopp, antall levert, progress (mobil + desktop), filter.
2. **Per vindu:** firma → lokasjon med adresse, vindu, kontakt, ordretelling, levert/ikke levert, **Markér levert** (POST `/api/driver/confirm`).
3. **Verktøy-sheet:** oppsummering, progress, oppdatering, utlogging.

## Ikke omfattet (2C3)

- Kitchen, superadmin tower, employee `/week`, onboarding, billing — uendret.
