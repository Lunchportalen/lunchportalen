# U24 — Beslutning

## 1. Endelig beslutning

**GO WITH CONDITIONS**

- Block allowlist er **håndhevet** på server når `documentType` er satt i envelope, og **speilet** i klient.
- Type-governance er **git-persistert** (kode-registry), ikke CRUD i database.

## 2. Hva som er oppnådd

- CMS som kontrollplan: `contentDocumentTypes` + `blockAllowlistGovernance` + PATCH-validering.
- Domener uendret operativt; innhold lagres fortsatt i `content_page_variants`.
- Ukemeny/ukeplan: ikke endret.
- Settings: schema/create-options oppdatert for ærlig beskrivelse av håndheving.

## 3. Hva som fortsatt er svakt

- Legacy body uten envelope er ikke strengt styrt — krever migrering for full governance.
- DB-redigerbare typer = replatforming (se `U24_REPLATFORMING_GAPS.md`).

## 4. Nærhet til Umbraco 17

- **Sterkere** på faktisk block policy der envelope brukes.
- **Ikke** full Management API-paritet.

## 5. Før ubetinget enterprise-live-ready

1. Migrer kritiske sider til envelope + `documentType` der streng styring kreves.
2. Vurder eksplisitte flere dokumenttyper med ulike allowlister (fortsatt i kode eller DB senere).

## 6. Kan vente

- UI-polish på tom blokkliste.
- E2E for 422-path.
