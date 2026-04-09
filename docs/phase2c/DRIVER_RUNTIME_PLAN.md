# Phase 2C0 — Driver runtime plan (control tower)

**Rolle:** `driver` — mobil-først; **AGENTS.md S4:** ingen horisontal scroll, deterministisk rekkefølge (dato → slot → firma → lokasjon).

## 1. Eksisterende UI

| Fil | Formål |
|-----|--------|
| `app/driver/page.tsx` | Inngang |
| `app/driver/DriverClient.tsx` | Dagens stopp, gruppering (slot → firma → lokasjon), status levert, bekreftelse |

Klienten bruker bl.a. **`/api/driver/today`**, **`/api/driver/stops`**, **`/api/driver/orders`**, og **`POST /api/driver/confirm`** for «ferdig levert».

## 2. Eksisterende API-er

| Rute | Formål |
|------|--------|
| `GET /api/driver/today` | Dagens kontekst |
| `GET /api/driver/stops` | Stoppliste aggregert |
| `GET /api/driver/orders` | Ordre for sjåfør |
| `POST /api/driver/confirm` | Marker levering — **mutasjon** (begrenset: sjåfør kun **i dag** per implementasjon) |
| `POST /api/driver/bulk-set` | Bulk — **sensitiv**; verifiser rolle og scope |

### Trygge handlinger (per nåværende mønster)

- Les dagens stopp og ordretelling.  
- Bekreft levering for **dagens dato** som `driver` med gyldig `slot` + `companyId` + `locationId`.  
- Superadmin kan ha videre rettigheter i noen ruter — hold **én** kontrakt i dokumentasjon.

### `confirm`-logikk (prinsipp fra `route.ts`)

- Validerer dato, påkrevde felt, profil (firma/lokasjon), deaktiverte brukere avvises.  
- Sjåfør kan **ikke** bekrefte annen dato enn «i dag» (Oslo-dato).

## 3. Source of truth

| Data | Sannhet |
|------|---------|
| Stoppliste | Server aggregert fra ordre/leveranser — ikke klient-konstruert |
| «Levert» | Persistert via `confirm` (felt som `delivered`, `deliveredAt`, `deliveredBy` i klienttyper) |
| Rekkefølge | API returnerer deterministisk sortering — UI må ikke omsortere «sannhet» |

## 4. Gap til full «control tower»

| Gap | Merknad |
|-----|---------|
| Mobil polish | Touch targets, offline — ikke del av 2C0 |
| Kart / navigasjon | Tredjepart — utenfor kjerne |
| Retur / del-levert | Krever produkt-API — ikke antatt |
| Bulk | Må risikovurderes før bruk i felt |

## 5. Tester (eksisterende)

- `tests/tenant-isolation-driver.test.ts`
- `tests/driver-flow-quality.test.ts`
- `tests/security/kitchenDriverScopeApi.test.ts`, `kitchenDriverScopeGuard.test.ts`
- `tests/rls/kitchenDriverScopePolicy.test.ts`

**Planlagte tester (2C+):** idempotent bekreftelse; dobbeltklikk; feil dato; deaktivert sjåfør.
