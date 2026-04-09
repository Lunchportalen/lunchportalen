# U20 — Discovery runtime

## Endepunkt

- `GET /api/backoffice/control-plane/discovery-entity-bundle?limit=40` (superadmin)
  - `data.contentPages[]` — `id, title, slug, status, updated_at`
  - `data.mediaItems[]` — `id, alt, url, status, source, created_at`

## Klient

- `BackofficeCommandPalette` henter bundle når paletten åpnes (`credentials: "include"`).
- `lib/cms/backofficeDiscoveryEntities.ts` — `entityRowsForDiscoveryPalette` + `mergeDiscoveryPaletteItems`.
- **Tom query:** kun manifest (ingen entitetsstøy).
- **Ikke-tom query:** manifest-rader (filtrert + U19-rank) **deretter** matchende entiteter.

## Ikke-mål

- Ingen Elasticsearch, ingen parallell palett.
