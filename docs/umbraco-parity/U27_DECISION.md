# U27 — Decision record

## 1. Endelig beslutning

**GO WITH CONDITIONS**

- Betingelser: superadmin-bruk for governance-usage API; skanning cap akseptert for store databaser; ingen forventning om full Umbraco Management API CRUD.

## 2. Hva som er oppnådd

- **CMS som kontrollbase:** innhold, schema-registry, settings-hub, nå **bruksinnsikt** fra faktiske varianter.
- **Domener mot CMS:** public pages via CMS body; backoffice redigering; AI/SEO/ESG som eksisterende moduler — U27 legger ikke nye motorer.
- **Uke/meny:** uendret operativ kjede — ikke flyttet til denne fasen.
- **Collections / bulk:** trygg multi-select + kopier editor-lenker i vekst; media-mønstre uendret.
- **Management usage:** read-only `governance-usage` + settings-side.
- **Legacy vs envelope:** aggregert og listebar; enkeltoppgradering fortsatt i workspace.
- **Sections/trees/workspaces:** ingen stor ombygging — dokumentert konsistens for entity-lenker.

## 3. Hva som fortsatt er svakt

- Full skanning uten cap kan være tung — krever evt. bakgrunnsjobb senere.
- Entity actions er ikke fullt ut harmonisert på alle flater (kun vekst + dokumentasjon).
- Moduler med LIMITED/DRY_RUN/STUB — se modul-manifest / eksisterende posture-dokumentasjon.

## 4. Hvor nær Umbraco 17-nivå

- **Arbeidsflyt/kontroll:** nær på collections (trygg bulk) og management read insights.
- **Teknisk identitet:** Node/Next — ikke .NET; se `U27_REPLATFORMING_GAPS.md`.

## 5. Før ubetinget enterprise-live-ready (minimalt)

1. Bekreft ytelse av governance-usage i produksjonsvolum (evt. indeks/async).
2. Fullfør eventuelle gjenstående RED i traffic-light der kritisk for go-live.

## 6. Kan vente

- Ekte server-side entity bulk med transaksjoner.
- Umbraco-lignende dynamisk extension-host.
