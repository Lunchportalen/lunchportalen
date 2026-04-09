# U21 — Beslutning

## 1. Endelig beslutning

**GO WITH CONDITIONS** — workspace-kontekst, actions/footer og AI policy-UI er levert som **props-basert** UX-lag på eksisterende shell. Full teknisk Umbraco Workspace Context API er **ikke** duplisert.

## 2. Hva som er oppnådd

- **CMS** som kontrollplan: tydeligere «hva redigeres / hva påvirkes» på domener, uke/meny, SEO, social, ESG, media.
- **Domener som snakker med CMS:** uendret sannhet — bedre forklaring og hurtiglenker.
- **Uke/meny:** fortsatt via Sanity + API-kjede; ingen dobbel sannhet.
- **Workspace context / actions:** `WorkspaceContextChrome`, primær/sekundær toolbar, `footerApps`.
- **AI:** eksplisitt policy-panel + eksisterende status/governance.
- **Sections/trees:** manifest (CP13) uendret.

## 3. Hva som fortsatt er svakt

- Ingen plugin-baserte footer apps — kun React-props.
- Content workspace (blokkeditor) har ikke full refaktor i denne fasen.

## 4. Nærhet til Umbraco 17

- **Atferd og kontrollplan:** sterkere. **Kjerne:** fortsatt Next/Supabase.

## 5. Før ubetinget enterprise-live-ready

1. Eventuell E2E på oppdaterte workspaces (visuell regresjon).
2. `sanity:live` mot deploy (miljøavhengig).

## 6. Kan vente

- Redigerbar policy i database.
- Dyp integrasjon av `u20id` på media-siden.
