# Ansatt vs admin: synlighet for pris og MVA-linjer

**Status:** arkitekturforslag (oppfølging i egen MR).  
**Kontekst:** PostgreSQL har ikke kolonnenivå-RLS; direkte `SELECT` på `order_items` / `orders` med dagens grants kan ikke skjule enkeltfelt.

## Kolonner som bør skjules for ansatte (employee)

Basert på faktisk økonomidata (ikke operativ/metadata):

### `public.order_items`

- `unit_price_cents_ex_vat`
- `line_subtotal_cents_ex_vat`
- `line_vat_cents`
- `line_total_cents_inc_vat`
- `vat_rate_snapshot`

### `public.orders`

- Alle felt som avslører beløper i øre/kroner på ordrenivå (verifiser mot produksjonsskjema), f.eks.:
  - `total_cents_ex_vat` (hvis kolonne finnes)
  - `vat_cents`
  - `gross_cents_inc_vat`

Ikke-admin skal beholde: identitet, menylinje, antall, dato/lokasjon/status, sporbarhetsfelt som ikke avslører pris.

## Strategier vurdert

1. **SECURITY BARRIER VIEW** for ansatte (kun ikke-pris-projeksjon): god som sekundær sannhet i Postgres; krever at app/RLS bare leser gjennom view eller at grants omadresseres nøye.
2. **Splitt-tabeller** (`order_items_public` + `order_items_full`): sterk isolasjon men høy migrasjonskostnad og JOIN-kompleksitet.
3. **App-side projection (anbefalt primær):** serverlag velger felter ut fra rolle; typer som `EmployeeOrderView` vs `AdminOrderView`; ingen prisfelt i JSON til employee-API-er.
4. **Revoke `SELECT`, kun RPC:** maks kontroll og audit, men stor refaktor av alle lesere.

## Anbefaling (to-spor)

**Primær (3):** Implementer eksplisitte typer og fetchere, f.eks.:

- `lib/orders/getOrderForUser.ts` → `EmployeeOrderView` (uten prisfelt)
- `lib/orders/getOrderForAdmin.ts` → full `AdminOrderView`
- API-ruter: `company_admin` og over → full struktur; `employee` → begrenset.

**Komplementær (1):** Etabler f.eks. `employee_order_items_safe`/`employee_orders_safe` views som dokumentert kontrakt for fremtidig hardening eller rapportering som ikke må gå via app.

Fail-closed ved usikker rolle eller manglende filter: ikke returner pris.
