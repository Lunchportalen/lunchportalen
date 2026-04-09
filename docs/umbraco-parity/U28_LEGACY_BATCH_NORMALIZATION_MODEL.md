# U28 — Legacy batch normalization model

## Identifikasjon (uendret)

- **Legacy:** `parseBodyEnvelope(body)` gir tom/manglende `documentType`.
- **Governed:** ikke-tom `documentType` i envelope.

## Eksisterende enkelt-transform

- `previewNormalizeLegacyBodyToEnvelope(documentTypeAlias, rawBody)` (`legacyEnvelopeGovernance.ts`):
  - Avviser hvis allerede har `documentType`.
  - Bygger `serializeBodyEnvelope` + `validateBodyPayloadBlockAllowlist`.
  - **Bevist trygg** for batch kun når samme funksjon brukes per rad.

## U28 batch-atferd

- **POST** `/api/backoffice/content/batch-normalize-legacy` (superadmin):
  - Body: `pageIds[]` (cap, f.eks. 25), `documentTypeAlias`, `dryRun`, valgfri `locale`/`environment` (default nb/prod).
  - Per side: les variant → preview → ved `dryRun: false` skriv til `content_page_variants` + versjon/audit som enkelt-PATCH.
- **Ikke batch:** sider som feiler preview (forbudte blokktyper, ukjent DT) — rapporteres per `pageId`.

## Ikke levert

- «Silent» migrering av alle rader uten liste.
- Batch som hopper over allowlist.

## Må vente

- Automatisk repair av allowlist-konflikter (krever redaktør eller egen policy).
