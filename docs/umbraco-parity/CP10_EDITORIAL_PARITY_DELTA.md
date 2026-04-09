# CP10 — Editorial parity delta

**Dato:** 2026-03-29  
**Bygger på:** CP1–CP9, `docs/umbraco-parity/**`, `docs/cms-control-plane/**`.

## Nær Umbraco-paritet (allerede)

- **Backoffice-seksjoner** med samlet nav (`TopBar`) og **én kilde** for moduler (`lib/cms/backofficeNavItems.ts`).
- **Content workspace:** tre med hurtigsøk (CP9), split editor, paneler (SEO, CRO, konflikt, recovery, AI-kontekst).
- **Media** (`/backoffice/media`), **domener** (`/backoffice/domains`), **kunder/avtale/runtime**, **uke & meny** som kontrollflate over eksisterende operativ kjede.
- **Meny:** én Sanity-kilde + CP7 broker; dokumentert i tidligere faser.
- **Modulpostering:** LIVE / LIMITED / DRY_RUN / STUB / INTERNAL_ONLY som språk i UI der implementert.

## Merkbare editor-gap (etter CP10-kode)

- **Global fulltext** på tvers av Postgres + Sanity + media uten ny indeks — fortsatt ikke Umbraco-nivå.
- **Én samlet tidslinje** for alle versjoner (sider vs meny vs media) — fortsatt ikke teknisk én motor; kun **fortelling** og **ærlig** om hvor historikk lever.
- **To publish-motorer** (side-workflow vs meny) — fortsatt **to spor**; paritet er **språk + synlig status**, ikke én motor.

## Løst siden baseline (CP9 → CP10)

- **Global hurtignavigasjon:** `BackofficeCommandPalette` (Ctrl+K / ⌘K) filtrerer **eksisterende** `BACKOFFICE_NAV_ITEMS` — ingen ny søkemotor.
- **Nav-konsistens:** TopBar og palett deler samme liste, mindre «patchwork» ved nav-endring.

## Åpen plattformrisiko

- **Enterprise search** (Elasticsearch, felles indeks) — replatforming; ikke levert i CP10.
- **Full teknisk rollback** for alle domener på én knapp — ikke lovet uten eksisterende API.

## Hva som må bygges videre for «ett samlet CMS» for redaktør

- Dypere **document-type / property-editor**-språk (se `CP10_DOCUMENT_TYPE_PROPERTY_EDITOR_MAP.md`).
- **Publish/history**-fortelling uten å forfalske unified history (se `CP10_PUBLISH_HISTORY_ROLLBACK_PLAN.md`).
- **Domain workspaces** som tydelige innganger uten ny sannhetsmodell (se `CP10_DOMAIN_WORKSPACE_PARITY.md`).
