# U28 — Decision record

## 1. Endelig beslutning

**GO WITH CONDITIONS**

- Betingelser: batch kun superadmin; maks 25 sider; samme transform som U26-preview; nb/prod default; feil per side stopper ikke hele batch-listen (se resultat).

## 2. Hva som er oppnådd

- **CMS** som base for innhold med **tydeligere** entity action-styling og **management coverage** (allowlist OK vs brudd).
- **Domener:** uendret runtime-sannhet for ordre/billing/week — CMS utvidet med kontrollflate.
- **Uke/meny:** ikke endret i U28.
- **Collections/bulk:** vekst bruker delt lenke-stil; governance insights har **reviewbar batch** (dry-run + utfør).
- **Legacy/envelope:** batch-normalisering via `batch-normalize-legacy` + enkelt workspace som før.
- **Sections/trees/workspaces:** ingen strukturell ombygging.

## 3. Hva som fortsatt er svakt

- Palette/discovery uten overflow-meny per rad (akseptabelt).
- Skanning cap i governance-usage ved svært store tabeller.
- Moduler LIMITED/DRY_RUN/STUB — ikke endret i U28.

## 4. Nærhet til Umbraco 17

- **Flyt:** nær på batch review + coverage counts.
- **Teknisk:** Next/Supabase — se `U28_REPLATFORMING_GAPS.md`.

## 5. Før ubetinget enterprise-live-ready

1. Lasttest batch + governance-usage i produksjonsvolum.
2. Avklar om company_admin skal ha read-only insights (egen sikkerhetsreview).

## 6. Kan vente

- Dynamisk extension manifest for menyer.
- Persisterte property-presets i DB.
