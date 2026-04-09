# U22 — Beslutning

## 1. Endelig beslutning

**GO WITH CONDITIONS** — collection-toolbar + trygg bulk + property dataset-forklaring er levert uten ny collection-plattform eller batch-API.

## 2. Hva som er oppnådd

- **CMS** forblir kontrollplan; media og vekst har **Umbraco-lignende** collection-mønster (søk, filter, radhandlinger).
- **Domener:** uendret sannhet — ikke ombygget i U22.
- **Uke/meny:** uendret publiseringskjede.
- **Collections / entity actions / property dataset:** se runtime-dokumenter.
- **Manifest / shell:** som U21.

## 3. Hva som fortsatt er svakt

- Ingen server-side bulk for media.
- Andre backoffice-lister (templates, users, …) bruker ikke ennå `BackofficeCollectionToolbar`.

## 4. Nærhet Umbraco 17

- **UX-paritet** for collections og feltforklaring er bedre; **ikke** .NET property editor pipeline.

## 5. Før ubetinget enterprise-live-ready

1. Eventuell E2E på media-valg + clipboard i målnettlesere.
2. Utvide toolbar til flere lister etter behov.

## 6. Kan vente

- Batch-API for media med idempotens og audit.
