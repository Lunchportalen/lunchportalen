# U19 — Discovery, history & AI baseline

**Dato:** 2026-03-29

## Nær Umbraco 17-paritet (før U19-kode)

- **Extension registry** + alias-filtrering (U18).
- **Command palette** Ctrl/⌘K.
- **Historikk-strip** med punktliste + tre spor (U18).
- **AI Control Center** med full modulposture-tabell (U18).

## Under paritet (U19 mål)

- **Indeksert** relevansrangering (ikke bare substring-rekkefølge).
- **Tydelig redaksjonell tidslinje-UX** (tre spor visuelt).
- **AI governance UI**: human approval, kost/leverandør, konfigurasjonsforklaring.

## Løst i U19

- `lib/cms/backofficeDiscoveryIndex.ts` — precomputert blob per `href` + `rankDiscoveryNavItems`.
- `CmsHistoryDiscoveryStrip` — grid med spor A/B/C (UX, ærlig om kilder).
- `AiGovernanceHumanAndCostPanel` — menneskelig kontroll + kost + env-integritet.
- Palett bruker rankering etter filtrering.

## Åpne risikoer (uendret)

- Ingen Elasticsearch/Algolia — bevisst.
- Ingen sammenslått teknisk event-logg på tvers av Postgres/Sanity.
