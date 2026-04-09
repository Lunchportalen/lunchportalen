# U27 — Management usage insights model

## Read-only settings-/management-flater i dag

- `/backoffice/settings/schema` — dokumenttyper / data types (kode-registry).
- `/backoffice/settings/create-options` — hva som kan opprettes.
- `/backoffice/settings/management-read` — U26 JSON-eksponering av registry.
- `/backoffice/settings/governance-insights` — **U27:** faktisk bruk i innhold (varianter).

## Usage-innsikt som manglet før U27

- Telling **legacy vs governed** per variant.
- **documentType**-fordeling (alias → antall varianter).
- **Blokktype**-forekomster (`extractBlockTypeKeysFromBodyPayload`).
- Liste over **legacy-side-IDer** (sample) for operativ gjennomgang.

## Speiling av Management API-tenkning

- Umbraco **Management API** er egen HTTPflate med CRUD på schema — Lunchportalen har **code-first registry** + **read-only** HTTP for innsikt.
- Ingen ny API-plattform: ett endepunkt `GET /api/backoffice/content/governance-usage` (superadmin) som returnerer `jsonOk`-data.

## Code-governed vs persisted

- **Document types / block labels:** fortsatt code (`contentDocumentTypes`, `backofficeSchemaSettingsModel`).
- **Usage counts:** avledet fra `content_page_variants.body` ved lesing — ikke egen «usage table» (unngår dobbel sannhet).

## Hva som forblir code-governed

- Tillatte dokumenttyper og allowlist — endres via deploy/kode, ikke via falsk CRUD-UI.
