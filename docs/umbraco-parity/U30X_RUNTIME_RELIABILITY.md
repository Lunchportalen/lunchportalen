# U30X — Runtime reliability (CMS-nære ruter)

## Tree (`GET /api/backoffice/content/tree`)

- **Happy path:** `degraded: false` + `roots` + valgfrie `schemaHints` ved `page_key`-fallback.
- **Manglende tabell:** `degraded: true`, `reason: TABLE_OR_CONTENT_PAGES_UNAVAILABLE`.
- **Schema/cache (kolonne/RPC):** `degraded: true`, `reason: SCHEMA_OR_CACHE_UNAVAILABLE`, `schemaHints.queryFailed` + detalj (RC).
- **Kritisk fiks:** `isMissingTableError` ignorerer rene kolonne-«does not exist»-feil.

## Audit (`GET /api/backoffice/content/audit-log`)

- Uendret kontrakt; utvidet `isAuditLogTableUnavailableError` for flere PostgREST/tilgangsvarianter.

## UI

- `ContentTree` viser norsk forklaring når tre eller schema er degradert.
