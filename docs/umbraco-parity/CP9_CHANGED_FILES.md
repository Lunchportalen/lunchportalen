# CP9 — Changed files

## Kode

| Fil | Hvorfor | Minimal risiko |
|-----|---------|----------------|
| `app/(backoffice)/backoffice/content/_tree/treeMock.ts` | Pure helpers: `contentTreeNodeMatchesFilter`, `collectVisibleNodeIdsForTreeFilter`, `collectExpandedIdsForTreeFilter` | Ingen nettverk; brukt av tre |
| `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx` | Klient-side «Søk i tre…» (CP9 editorial parity) | Kun filtrering av eksisterende data; recycle-bin skjules ved irrelevant filter |
| `tests/cms/contentTreeHardening.test.ts` | Tester for filter-hjelpere | Regresjon |

## Dokumentasjon

- Nye `docs/umbraco-parity/CP9_*.md` + sluttfiler.

## Ikke endret

- Auth, middleware, `GET /api/week`, ordre, billing, Supabase, onboarding.
