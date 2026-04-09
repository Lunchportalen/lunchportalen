# U37 Runtime Truth Runtime

## Landed Now
- `publish`-route skriver nå den kanoniske audit-handlingen `publish` via `CONTENT_AUDIT_ACTION_PUBLISH`, ikke den DB-ugyldige verdien `content_publish`.
- `system_settings` leses nå via én kanonisk baseline-leser. Backoffice-API og system-workspace får samme `settings + baseline`-payload, og UI går i read-only når baseline ikke er `ready`.
- `esg_monthly` leses nå i kanonisk `delivered_count/cancelled_count`-form, men kan falle tilbake ærlig til legacy-kolonner uten å returnere falske nulltall eller 500.
- Tree- og audit-rutene returnerer nå eksplisitt degraded-state med `reason`, `operatorMessage`, `operatorAction`, `detail`, `code` og relevante schema-hints.

## Closed Gaps
- Publish/audit-kontraktsbrudd er lukket i kode og test.
- `system_settings` er ikke lenger “best effort”; baseline-status er eksplisitt `ready | row_missing | table_missing | read_error`.
- ESG-schema-drift er lukket som lesebro, ikke skjult som grønn sannhet.
- Operatoren får nå konkrete neste steg i tree/audit i stedet for generiske tomtilstander.

## Honest Stops
- `sanity:live` passerte som soft gate, men mot lokal URL uten aktiv server; det ga warning og ingen live HTTP-verifikasjon.
- Runtime-truth er styrket, men ikke alle management-objekter er blitt persisted CRUD. Kode-governed flater forblir eksplisitt read-only der backend ikke finnes.
