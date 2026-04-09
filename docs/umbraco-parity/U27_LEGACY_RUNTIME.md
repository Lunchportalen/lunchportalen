# U27 — Legacy runtime (levert)

## Lesing og review

- `GET /api/backoffice/content/governance-usage` returnerer:
  - `governedVariants` / `legacyVariants`
  - `legacyPageIds` (sample, cap)
  - `byDocumentType`, `blockTypeCounts`
  - `scanCapped` / `maxScan` når full skanning ikke kjøres på alle rader

## UI

- `/backoffice/settings/governance-insights` viser tall og lenker til `/backoffice/content/[id]` for legacy-utvalg.

## Ikke levert

- Automatisk batch-normalisering av alle rader i databasen.
- Skjult masse-oppgradering uten review.

## Ærlighet

- `parseBodyEnvelope`-semantikk er autoritativ for «legacy» i denne fasen; edge cases dokumenteres ved behov i kodekommentarer.
