# CMS — Enterprise hardening (CP7)

## Grep gjennomført

- Ny API: **fail-closed** uten token; superadmin-only; ingen klient-hemmeligheter.
- Ingen endring av middleware eller auth-layout.

## Gjenstående (ikke CP7)

- Dypere audit på alle backoffice-ruter — kan prioriteres i egen hardening-runde.
- `menu_visibility_days` vs Sanity — eksplisitt operativ runbook (fremtidig).

## Ops

- Dokumenter i drift: `SANITY_WRITE_TOKEN` rotasjon og hvem som kan bruke broker-UI.
