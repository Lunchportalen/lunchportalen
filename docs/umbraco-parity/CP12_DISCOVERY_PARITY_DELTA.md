# CP12 — Discovery parity delta

**Dato:** 2026-03-29  
**Bygger på:** CP1–CP11.

## Nær Umbraco-paritet (allerede)

- **Kommandopalett** (Ctrl+K) med grupperte moduler (CP11).
- **Content tree-søk** (CP9) og **media-liste** med filter.
- **Workspace-krom** (`BackofficeWorkspaceSurface`, CP11).
- **Uke & meny** med ærlig to-spors-forklaring og publish/history-notis.

## Merkbare discovery-/history-gap (før CP12-kode)

- **Ingen global fulltext** på tvers av Postgres + Sanity + media uten indeks.
- **Historikk** teknisk splittet (Postgres recovery vs Sanity Studio) — trenger **samme fortelling** uten falsk motor.
- Noen **nyttige ruter** (papirkurv, control tower) var ikke i primærnav/palett-listen.

## Løst i CP12 (kode)

- **`BACKOFFICE_DISCOVERY_EXTRAS` + `BACKOFFICE_PALETTE_ITEMS`** — papirkurv og control tower i paletten (deduplisert).
- **`CmsHistoryDiscoveryStrip`** — global, ærlig «hvor finnes historikk» under runtime-status.
- **`BackofficeShell`** — valgfri `historyStrip` fra layout.

## Åpen plattformrisiko

- **Elasticsearch/OpenSearch** eller tilsvarende — fortsatt ikke levert.
- **Én teknisk audit-tidslinje** — krever produktarkitektur utover UX-stripe.

## Hva CP12 skal gi redaktør

- Raskere **oppdagelse** av nøkkelruter uten ny plattform.
- **Tydelig historikk-fortelling** uten å late som alt er én database.
