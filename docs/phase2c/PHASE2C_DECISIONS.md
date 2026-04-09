# Phase 2C0 — Decisions (planning)

| ID | Beslutning |
|----|------------|
| D1 | **CMS/backoffice** forblir hovedenhet for innhold; operative towers er egne flater men deler ikke duplikat sannhet. |
| D2 | **`src/components`** er canonical komponentrot for delt UI. |
| D3 | **Eksisterende API-flyt** gjenbrukes; nye endepunkter kun der dokumentert gap. |
| D4 | **Én source of truth per flate** (tabell nedenfor). |
| D5 | **Høyrisiko-mutasjoner sist** (superadmin global, billing, cron). |

## Source of truth per control tower-flate

| Flate | Primær sannhet |
|-------|----------------|
| **Company admin** | `profiles.company_id` + `app/api/admin/*` + `loadAdminContext` |
| **Superadmin** | `app/api/superadmin/*` + frosne livsløp-ruter; `capabilities.ts` som nav-inventar (ikke sannhet i seg selv) |
| **Kitchen** | `GET /api/kitchen` (+ relaterte read-API) — ordreaggregat på server |
| **Driver** | `GET /api/driver/stops` / `today` + `POST /api/driver/confirm` for leveringsstatus |

## Hva som kan bygges trygt først

1. **Company admin** — lesende tower (KPI, lenker, konsistens) innen eksisterende scope.  
2. **Kitchen** — lesende tower (én dato, én liste, eksport) uten nye mutasjoner.  
3. **Driver** — mobil UX og tydelig status på eksisterende API.  
4. **Superadmin** — etter at kjerneoperativt er stabilt; **unngå** å røre frosne system-/firma-flyter uten egen PR.

## Hva som må vente

- **Binding / oppsigelse / 3-mnd-påminnelse** — datamodell + cron + varsling.  
- **Full økonomi-tower** som ikke allerede har API-fasit.  
- **Nye** superadmin «control-tower/*»-konsepter uten produkt-eier.

## Høyest risiko-mutasjoner (ikke start i 2C1 uten spec)

- Superadmin: `activate`, `set-status`, bruker delete/disable, avtale reject/approve.  
- Company admin: `company/status/set` (hvis eksponert bredt).  
- Billing-eksport som påvirker bokføring.  
- Driver: `bulk-set` uten idempotens-review.

## Datamodeller: finnes vs mangler (planleggingsnivå)

| Behov | Finnes (typisk) | Mangler / avklares |
|-------|-----------------|---------------------|
| Ordre / leveranser | Ja | — |
| Firma / avtale | Ja | Binding-dato synlig i API? |
| Faktura (B2B/14d) | Delvis | Company admin «faktura-oversikt» som produkt |
| Påminnelse 3 mnd | Nei | Cron + notification + lag |

## Referanse til eldre plan

- `docs/phase2/COMPANY_ADMIN_CONTROL_TOWER_PLAN.md` — fortsatt relevant; 2C0 utvider med superadmin/kitchen/driver og sekvens.

---

## Phase 2C1 — Company admin runtime MVP (2026-03-28)

| ID | Beslutning |
|----|------------|
| D6 | **company_admin source of truth:** uendret — `profiles.company_id` + `loadAdminContext` + eksisterende `app/api/admin/*`. |
| D7 | **`/admin` flater:** én **AdminNav** (company_admin only); superadmin ser ikke company tower-nav på `/admin`. |
| D8 | **Deprecate:** ingen ruter slettet; **canonical** «Ansatte»-inngang i nav er `/admin/users` (parallelle `people`/`employees` uendret). |
| D9 | **Økonomidata på oversikt:** kun **telle**-KPI (ansatte, lokasjoner, ordre dag/uke) — **ingen** beløp; faktura = **CSV** som før. |
| D10 | **Aktive handlinger:** uendrete API-er; **ingen** ny oppsigelsesmutasjon. |
| D11 | **Binding/påminnelse:** **lesing** av `binding_months`/`notice_months` på avtale; **ingen** cron — eksplisitt i UI. |
| D12 | **Avtale-API:** `GET /api/admin/agreement` er canonical for AgreementPageData; gammel klient-URL til `.../my-latest` **fjernet**. |

---

## Phase 2C2 — Kitchen runtime MVP (2026-03-28)

| ID | Beslutning |
|----|------------|
| D13 | **Kitchen source of truth (uendret prinsipp):** `GET /api/kitchen` for linjevis produksjon; `GET /api/kitchen/report` (+ CSV) for aggregert hierarki — samme ordregrunnlag, ingen parallell motor. |
| D14 | **`/kitchen` er canonical** overflate: `KitchenRuntimeClient` med faner **Produksjonsliste** og **Aggregert rapport**; delt dato-state. |
| D15 | **`/kitchen/report` deprecate som egen IA:** redirect til `/kitchen?tab=aggregate`. |
| D16 | **`KitchenView` beholdt** for aggregert visning; **utvidet** med valgfri `syncDateISO` / `onSyncDateISOChange` for delt dato med produksjonsfanen. |
| D17 | **Ekte data:** ordre-rader, firma/lokasjon/ansatt/meny som i `/api/kitchen`; **tier på linje** ikke pålitelig (`null` i API) — dokumentert; Basis/Luxus i aggregert rapport. |
| D18 | **Handlinger:** read-first; ingen nye mutasjoner; eksisterende CSV/print/prognose uendret i omfang. |
| D19 | **Klient-fix:** `jsonOk`-konvolutt for `/api/kitchen` må pakkes ut — `lib/kitchen/kitchenFetch.ts` + bruk i `KitchenProductionPanel`. |
| D20 | **Før flere kjøkken-mutasjoner:** eksplisitt API-kontrakt, audit, idempotens, egen PR — ikke del av 2C2. |

---

## Phase 2C3 — Driver runtime MVP (2026-03-28)

| ID | Beslutning |
|----|------------|
| D21 | **Driver source of truth:** `GET /api/driver/stops` for stopp-liste; `delivery_confirmations` via `POST /api/driver/confirm`; CSV via `GET /driver/csv` — samme ordre-/scope-sannhet som før. |
| D22 | **`/driver` er canonical** overflate: `DriverRuntimeClient` (wrapper) + `DriverClient` — **én** liste, ingen parallell IA. |
| D23 | **`/driver/csv` beholdt** som eksport-endpoint (ikke egen «side»); lenket per vindu i UI. |
| D24 | **Ekte data:** stopp-felt som API returnerer; **`deliveredBy` kan være bruker-id** i UI — dokumentert; filter er kun klient. |
| D25 | **Aktive handlinger:** `confirm` (ekte runtime), CSV-nedlasting, refresh; **ikke** `bulk-set` i denne flaten. |
| D26 | **Normalisering:** `normalizeStopsResponse` i `lib/driver/normalizeStopsResponse.ts` — delt og testet. |
| D27 | **Før flere driver-mutasjoner:** egen PR med idempotens/audit; bulk og del-levering utenfor 2C3. |

---

## Phase 2C4 — Superadmin runtime MVP (2026-03-28)

| ID | Beslutning |
|----|------------|
| D28 | **Superadmin source of truth:** uendret — `capabilities.ts` for navigasjon; `companies`/`agreements`/`orders` via eksisterende API og sider; system-sannhet på `/superadmin/system` (frosset logikk). |
| D29 | **`/superadmin` canonical hjem:** `loadSuperadminHomeSignals()` (server) + `SuperadminControlCenter` — **én** forsterket kontrollflate; ingen parallell «superadmin v2». |
| D30 | **Deprecate:** ingen ruter fjernet; vekst/backoffice-lenker forblir i `capabilities` men dokumentert som egne spor. |
| D31 | **Ekte data på hjem:** signaler fra `supabaseAdmin` lesing — samme mønster som dashboard (firmastatus, ordre, PENDING-avtaler); ved feil vises banner, ingen falske tall. |
| D32 | **Aktive handlinger på hjem:** kun navigasjon (lenker); **ingen** nye mutasjoner på forsiden. |
| D33 | **Høyrisiko** (activate, set-status, approve/reject, user delete): fortsatt kun på eksisterende sider/API — **ikke** aktivert bredere i 2C4. |
| D34 | **Før destruktive/bulk-handlinger:** egen sikkerhets-PR, bekreftelses-UX og audit — ikke del av 2C4. |
