# U30 — Tree & audit runtime

## Tree (`GET /api/backoffice/content/tree`)

- Uendret autorisasjon: **superadmin** (samsvar med øvrig backoffice content-API).
- Klient (`ContentTree`) gir nå **eksplisitt tekst** for **401** og **403** i stedet for generisk HTTP-feil.

## Audit (`GET /api/backoffice/content/audit-log`)

- Ved manglende Postgres-relasjon (`42P01` / `content_audit_log` «does not exist»): **HTTP 200**, `data.items: []`, `data.degraded: true`, `data.reason: TABLE_OR_SCHEMA_UNAVAILABLE`.
- Unngår **500 / AUDIT_LOG_FAILED** for «tomt miljø» uten migrasjon.
- UI (`EditorialAuditTimelinePanel`) viser **ærlig degradert** banner — ikke tom stillhet.

## Tester

- `tests/api/contentAuditLogRoute.test.ts` — degradert gren case.
