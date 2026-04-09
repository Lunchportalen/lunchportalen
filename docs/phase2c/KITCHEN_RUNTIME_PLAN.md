# Phase 2C0 — Kitchen runtime plan (control tower)

**Rolle:** `kitchen` (+ ev. `superadmin` for support).  
**AGENTS.md S3:** Kjøkken er **read-only** system truth — ingen manuelle overstyringer i produktet.

## 1. Eksisterende UI

| Fil | Formål |
|-----|--------|
| `app/kitchen/page.tsx` | Inngang |
| `app/kitchen/KitchenClient.tsx` | Dato, tabell med firma/lokasjon/ansatt/meny/tier, oppsummering |
| `app/kitchen/KitchenView.tsx` | (wrapper / layout) |
| `app/kitchen/report/page.tsx` | Rapport |

Klienten kaller primært **`GET`**-API med `date` (YYYY-MM-DD) og håndterer helg / ingen ordre / pausede firmaer.

## 2. Eksisterende API-er (`app/api/kitchen/**`)

| Rute | Formål |
|------|--------|
| `GET /api/kitchen` | Produksjonsliste per dato — hoveddata |
| `GET /api/kitchen/today` | Dagens snapshot |
| `GET /api/kitchen/day` | Dag-kontekst |
| `GET /api/kitchen/orders` | Ordre for kjøkken |
| `GET /api/kitchen/orders.csv` | Eksport |
| `GET /api/kitchen/companies` | Firmaer |
| `GET /api/kitchen/company` | Enkeltfirma |
| `GET /api/kitchen/report`, `report.csv` | Rapport |
| `GET /api/kitchen/demand-forecast` | Etterspørsel |
| **Batch** `batch/*` | Produksjonsbatch — **muterende** (start/set/reset/upsert) |

### Read-only vs muterende

- **Lesing / liste / CSV:** i tråd med «tower» (operativ oversikt).  
- **Batch:** kan være intern produksjonsflyt — **må** kartlegges: tenant-isolasjon, idempotens, hvem som har lov (kun kitchen/superadmin?). Ikke utvid uten eksplisitt krav.

## 3. Datamodell i respons (fra klient-typer)

`KitchenRow`: `company`, `location`, `employeeName`, `department`, `note`, `tier` (BASIS/LUXUS), `menu_title`, `menu_description`, `menu_allergens`.

Dette dekker: **dato**, **firma**, **lokasjon**, **ansatt**, **meny/måltidstype** (via menyfelter), **produksjonsliste** (rader).

## 4. Source of truth

| Behov | Sannhet |
|-------|---------|
| Dagens behov | `GET /api/kitchen?date=` + server-side ordreaggregat |
| Gruppering | Eksisterende logikk i API (ikke dupliser i klient som «sannhet») |
| Endring av ordre | **Utenfor** kitchen-rollen per S3 — eventuelt annen rolle/prosess |

## 5. Gap til «ekte control tower»

| Gap | Tiltak (senere fase) |
|-----|----------------------|
| Én sammenhengende IA | Én kjøkken-inngang med dato + KPI + eksport — unngå spredte admin/kitchen-test spor |
| Print / kjøkken-skjerm | `kitchen-print` tester finnes — utvid kun innen samme pipeline |
| Batch-mutasjoner | Dokumenter eierskap; ikke bland med read-only tower uten produktbeslutning |

## 6. Tester (eksisterende — referanse)

- `tests/kitchen/api-kitchen-route.behavior.test.ts`
- `tests/kitchen-batch-*.test.ts`, `tests/kitchen-print.test.ts`
- `tests/tenant-isolation-kitchen-batch-status.test.ts`
- `tests/security/kitchenDriverScopeApi.test.ts`, `kitchenDriverScopeGuard.test.ts`
- `tests/lib/kitchen/grouping.behavior.test.ts`

**Planlagte tester (2C+):** end-to-end «riktig firma/lokasjon per rad» under multi-tenant scenario; ingen falske tall ved tom liste.
