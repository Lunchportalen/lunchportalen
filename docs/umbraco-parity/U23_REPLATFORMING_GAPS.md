# U23 — Replatforming gaps

| Krav | Dagens stack | Gap |
|------|----------------|-----|
| Persisted document types i DB med UI CRUD | TypeScript-array + envelope | **REPLATFORMING_GAP** — krever modell + API + migrasjon |
| Persisted data types / property editor packages | Felt-schema i kode | **REPLATFORMING_GAP** eller langvarig produktløp |
| Umbraco Management API-paritet | Next.js routes + Postgres/Sanity | **REPLATFORMING_GAP** — annen API-form |
| Content type allowlist for blocks per document type | Global block-liste | Kan **simuleres** delvis i UX; **full enforcement** krever backend policy |
| Distributed cache (Umbraco) | Next/Vercel cache | **REPLATFORMING_GAP** — annen infrastruktur |

## Forsvarlig simulering på dagens stack
- Settings-hub + read-only schema/create dokumentasjon i UI.
- Tydelig **modulposture** og **LIMITED** der funksjoner ikke finnes.

## UX/flow-paritet uten teknisk likhet
- Document/data **governance** som **lesing og lenker** til kildefiler — tilstrekkelig for RC/enterprise-styre til videre beslutning.
