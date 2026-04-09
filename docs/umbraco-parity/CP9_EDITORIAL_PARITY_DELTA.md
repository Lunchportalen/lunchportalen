# CP9 — Editorial parity delta

**Dato:** 2026-03-29  
**Bygger på:** CP1–CP8, `docs/umbraco-parity/**`.

## Nær Umbraco-paritet (allerede)

- Backoffice **seksjoner** (`TopBar`), **content workspace** (tre + editor), **media**, **domain surfaces**, **module posture**.
- **Operativ meny-kjede** med Studio + CP7 broker dokumentert i kode.

## Merkbare editor-gap (før CP9-kode)

- **Innholdstre** manglet **hurtigsøk** i sidefeltet (typisk Umbraco tree search / filter).
- **Én samlet historikk** på tvers av Postgres + Sanity — fortsatt ikke én tidslinje.
- **To publish-motorer** (sider vs meny) — krever fortsatt tydelig språk.

## Løst i CP9 (kode)

- **Klient-side «Søk i tre»** i `ContentTree` med rene hjelpefunksjoner i `treeMock.ts` (ingen ny søkemotor, ingen API).

## Åpen plattformrisiko

- Global **backoffice-søk** på tvers av alle entiteter — fortsatt utenfor CP9 (ville kreve større plattform).

## Hva som må bygges for «ett samlet CMS» for redaktør

- **Umbraco-lignende navigasjonshastighet** — delvis adressert med tree-filter.
- Løpende **copy/IA** for document-type / property-editor (dokumentert).
