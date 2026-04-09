# Company admin — Avtale og økonomi (2C1)

## Avtaleinnsyn

- **Fiks:** Avtale-siden henter nå **`GET /api/admin/agreement`** (tidligere pekte klientfeil mot ikke-eksisterende `.../my-latest`).
- **Data:** `AgreementPageData` fra samme route — ukesplan, tier, binding (start/slutt/gjenstående dager), metrikk.
- **`terms`:** `binding_months` og `notice_months` leses **lesende** fra `agreements`-tabellen via avtalens `id` (best-effort).

## Økonomi / faktura

- **Ingen ny fakturamotor:** Fakturagrunnlag forblir **CSV** via `/api/admin/invoices/csv` (eksisterende `defaultInvoiceWindowISO` + avtalenormalisering).
- **Økonomi-innsikt:** `/admin/insights` — eksisterende metrics/insights-API; ikke utvidet med nye beløpsendepunkter i 2C1.

## Hva vi ikke lover

- Full «fakturaoversikt» med betalingsstatus i HTML — **ikke** levert uten eksisterende read-API som dekker det.
