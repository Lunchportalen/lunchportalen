# U18 — Discovery (runtime)

## Implementasjon

- **`discoveryAliases?: string[]`** på `BackofficeExtensionEntry`.
- **`getPaletteSearchStringByHref()`** bygger søkeblob (lazy memo).
- **`filterBackofficeNavItems`** inkluderer `blob.includes(q)`.
- **Tårn:** `discovery.tower-*` med `href` `/admin`, `/kitchen`, `/driver`, `/superadmin/overview`, `topBar: false`, `palette: true`.

## Ikke implementert

- Ekstern søkeindeks, Elasticsearch, duplikat palett.

## Tester

- `tests/cms/backofficeExtensionRegistry.test.ts` — `tårn`, `uke`.
