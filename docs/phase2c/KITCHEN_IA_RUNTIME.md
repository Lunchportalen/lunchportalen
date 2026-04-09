# Kitchen — informasjonsarkitektur (2C2 runtime)

## Kanonisk overflate

| Rute | Rolle | Formål |
|------|--------|--------|
| **`/kitchen`** | `kitchen`, `superadmin` (etter layout) | **En** operativ kjøkkenflate: faner for produksjonsliste og aggregert rapport, delt dato. |
| **`/kitchen?tab=aggregate`** | samme | Direkte til aggregert rapport (samme innhold som fane «Aggregert rapport»). |

## Samlet vs deprecate

| Før | Etter 2C2 |
|-----|-----------|
| `/kitchen` viste kun `KitchenView` (rapport-API) uten linjevis meny/ansatt fra `GET /api/kitchen`. | `/kitchen` bruker **`KitchenRuntimeClient`**: **Produksjonsliste** (API `/api/kitchen`) + **Aggregert rapport** (eksisterende `KitchenView` / rapport-API). |
| `/kitchen/report` egen side med `KitchenReportClient`. | **`/kitchen/report` redirecter** til `/kitchen?tab=aggregate` — unngår parallelle «kitchen-IA». Komponenten `KitchenReportClient.tsx` er ikke lenger routet (kan fjernes senere; ikke kritisk for 2C2). |

## Hva brukeren ser

1. **Produksjonsliste (standard)**  
   - Valgt dato (Oslo), KPI (totalt, firma, lokasjoner i utvalg).  
   - Fordeling: per firma, per lokasjon, per meny/måltid (tellinger fra filtrert liste).  
   - Filtrering: firma, lokasjon, meny/måltid.  
   - Gruppering: per firma, per lokasjon, per meny/måltid, eller flat liste.  
   - Linjer: ansatt, firma·lokasjon, menytekst/allergener, notat.

2. **Aggregert rapport**  
   - Eksisterende dag/uke, CSV, print, slot → firma → lokasjon → ansatte (Basis/Luxus-tall).  
   - Prognose-blokk (demand-forecast) uendret — beslutningsstøtte, endrer ikke bestillinger.

## Ikke omfattet (2C2)

- Driver, superadmin, employee `/week`, onboarding, billing — uendret.
