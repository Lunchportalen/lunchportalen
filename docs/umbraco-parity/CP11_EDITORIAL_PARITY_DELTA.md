# CP11 — Editorial parity delta

**Dato:** 2026-03-29  
**Bygger på:** CP1–CP10, `docs/umbraco-parity/**`.

## Nær Umbraco-paritet (allerede + CP10)

- Felles **TopBar**, **runtime-statusstrip** (`CmsRuntimeStatusStrip`), **kommandopalett** (Ctrl+K) over `BACKOFFICE_NAV_ITEMS`.
- **Content workspace** med tre, paneler og publish/workflow API.
- **Domener/kunder/avtale** med control-plane-kort og ærlig modulpostering.
- **Uke & meny** med eksplisitt to-spors-fortelling (operativ `menuContent` vs redaksjonell `weekPlan`).
- **Growth:** `CmsGrowthModuleCallout` for SEO/Social/ESG.

## Merkbare editor-gap (før CP11-kode)

- Ulik **workspace-krom** (noen sider: `PageContainer` + H1; andre: full høyde uten felles header; media: egne LP-tokens).
- **Flere H1** i samme visning mulig (growth-klienter hadde egen H1 + skulle hatt én i felles skall).
- **Publish/history** fortsatt **splittet** teknisk (Postgres vs Sanity Studio) — trenger **samme språk** i krom uten falsk tidslinje.

## Løst i CP11 (kode + docs)

- **`BackofficeWorkspaceSurface` / `BackofficeWorkspaceHeader`** — standard H1, ledetekst, `data-workspace`, valgfri publish/history-notis, varianter `default` / `fullBleed`.
- **Kommandopalett:** grupperte treff etter **`groupId`** på `BACKOFFICE_NAV_ITEMS` (ingen ny søkemotor).
- **Growth-sider (SEO/Social/ESG):** én H1 fra surface; duplikat-header fjernet i runtime-klienter.
- **Domener, kunder, avtale, uke/meny, media:** innordnet i samme workspace-språk der refaktor var trygt.

## Åpen plattformrisiko

- **Global indeks / fulltext** — fortsatt ikke levert.
- **Én teknisk historikkmotor** — replatforming; CP11 leverer **UX-konsistens og ærlighet**.

## Hva CP11 skal gi redaktør

- Opplevelse av **én workspace-modell** (header + status + innhold) på tvers av primærflater.
- **Ingen** ny sannhet for uke/meny/avtale.
