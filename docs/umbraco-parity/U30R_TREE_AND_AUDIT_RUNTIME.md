# U30R — Tree & audit runtime

## Tree

- Ved `page_key`-kolonne-feil: andre query uten kolonne → rader mappes til `PageRow` med `page_key: null` → `applyInferredPageKeys` fyller fra kjente slug-er.
- Respons kan inkludere `data.schemaHints.pageKeyColumnMissing`.
- `ContentTree` viser amber banner når hint settes.

## Audit

- `isAuditLogTableUnavailableError` fanger bl.a. PostgREST «schema cache» og `42P01`.
- 200 + `degraded` + tom liste når tabell mangler.

## Migrasjon

- `20260330120000_u30r_content_pages_page_key_if_missing.sql` legger til `page_key` hvis den mangler.
