# ESG — runtime-plan (2D0, kun plan)

**Status:** Planlegging — **ingen** ny ESG-runtime i 2D0.  
**Kanon:** ESG bygger på **målte** operative data — **ingen** påstand uten sporbar kilde.

---

## 1. Eksisterende data og pipeline (kartlagt)

### 1.1 Database

- **`esg_monthly_snapshots`**, **`esg_yearly_snapshots`** — felter inkl. `ordered_count`, `cancelled_in_time_count`, `waste_meals`, `waste_kg`, `waste_co2e_kg`, `cost_*`, `stability_score` (se `GET /api/superadmin/esg/summary`).

### 1.2 RPC og cron

- **`esg_build_daily`** — trigges fra `POST /api/cron/esg/daily` med `date` (Oslo-dag).
- **Månedlig/årlig:** `cron/esg/monthly`, `yearly`, `lock/*`, `generate` — batch og låsing av rapporteringsperioder.

### 1.3 API-flater

| Rolle | Eksempel | Merknad |
|-------|----------|---------|
| Superadmin | `/api/superadmin/esg/summary`, eksport JSON/CSV, PDF | Aggregater per `company_id` |
| Admin | `/api/admin/esg/*` | Firma-scope |
| Firma-detalj | `/api/superadmin/companies/[companyId]/esg` | Lesing |

### 1.4 UI

- **`/superadmin/esg`**, **`/superadmin/esg/[companyId]`** — eksisterende sider (superadmin).

---

## 2. Operative data som **kan** understøtte ESG (kildeforankring)

| Signal | Kilde | Bruk i ESG |
|--------|-------|------------|
| Avbestilling i tide | `cancelled_in_time_count` vs ordrer | Allerede i snapshots — **CONFIRMED** som designet |
| Matsvinn / avfall | `waste_meals`, `waste_kg`, CO2e-felter | Forutsetter korrekt **daglig** beregning i RPC |
| Leveranser / volum | `ordered_count`, ordrehistorikk | Knyttet til produksjon |
| Stabilitet | `stability_score` | Definisjon må dokumenteres i teknisk vedlegg (ikke 2D0) |

**Ikke** bruk: manuelle «grønne tall» uten DB-rad; marketing-tekst uten kobling til snapshot.

---

## 3. ESG-utsagn som kan støttes

- «Redusert svinn i kg / CO2e» — **hvis** `esg_*` er fylt og forklart.
- «Andel avbestillinger innen frist» — **hvis** definisjonen i RPC matcher forretningsregel.
- «Trend per måned» — fra `esg_monthly_snapshots`.

**Unngå:** Sammenligning med bransje uten **benchmark**-data (det finnes `/api/superadmin/esg/benchmark` — verifiser innhold før bruk i copy).

---

## 4. Visning: CMS vs company admin vs superadmin

| Flate | Anbefalt rolle i 2D |
|-------|---------------------|
| **Superadmin** | Sannhets- og rapportflate — allerede tilstede; forbedre **lesbarhet og sporbarhet** (ikke nye tall). |
| **Company admin** | **Read-only** innsikt der API finnes (`/api/admin/esg/*`); ingen ny «konkurranse» mot billing. |
| **CMS / marketing** | Kun **publiserbar** ESG-copy som er **koblet** til godkjente utdrag (statisk tekst eller CMS-felt med kildehenvisning internt). **Ikke** live tall på forsiden uten performance-/cache-vurdering. |

---

## 5. Hva som mangler før «ekte» ESG-runtime i produktforstand

- **Datakvalitet:** Verifiser at `esg_build_daily` kjører stabilt i alle miljøer (cron, secrets).
- **Definisjonsdokument:** Hva «in time», «waste», «stability» betyr — én side for revisorer.
- **UX:** Samme design system som 2A; unngå dashboard som ser ut som finans.
- **Juridisk:** ESG-claims i markedsføring må matche tall som kan eksporteres.

---

## 6. Tester (fremtidige)

- Cron: `requireCronAuth` — allerede mønster i andre cron-tester.
- API: tenant isolation for `/api/admin/esg/*` (company A ≠ B).
- PDF/eksport: ikke 500 på tom data — **fail closed** med melding.

---

## 7. Grense mot 2D Social/SEO

- Del **ikke** ESG-tall som «SoMe-fakta» uten manuell godkjenning og siste snapshot-dato synlig.
