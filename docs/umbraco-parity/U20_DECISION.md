# U20 — Beslutning

## 1. Endelig beslutning

**GO WITH CONDITIONS** — levert som kontrollert U20-lag (discovery-bundle, audit-read, AI status-UI) uten replatforming. `sanity:live` krever kjørende base-URL for hard verifikasjon i CI/prod.

## 2. Hva som er oppnådd

- **CMS** forblir synlig kontrollplan: manifest-palett + **faktiske** sider/media ved søk.
- **Domener som snakker med CMS:** innhold (`content_pages`, `media_items`), audit (`content_audit_log`), AI status (`/api/backoffice/ai/status`), eksisterende SEO/social/ESG-flater uendret i sannhet.
- **Uke/meny:** fortsatt forklart via eksisterende `/backoffice/week-menu` og strip — ingen ny menymotor.
- **Discovery/historikk/AI:** palett-fusjon + audit-feed + settings-panel — **ærlige** kilder.
- **Sections/trees/workspaces:** fortsatt modellert via CP13-registry; U20 berører ikke TopBar-datastruktur.

## 3. Hva som fortsatt er svakt

- Ingen global søkemotor; entitetsbundle er **begrenset** og **superadmin**-API.
- Media palett-lenke åpner bibliotek med `u20id` — valgfri fremtidig fokus-lesing i UI.
- Moduler med LIMITED/DRY_RUN/STUB forblir som i `MODULE_LIVE_POSTURE_REGISTRY`.

## 4. Hvor nær Umbraco 17 / verdensklasse

- **Arbeidsflyt og kontrollflate:** sterkere hurtigfunn og sporbarhet; **ikke** teknisk lik .NET-kjerne.
- **Historikk:** bedre **aggregert UX** for Postgres-audit; fortsatt **ingen** én teknisk motor på tvers av alle kilder.

## 5. Før ubetinget enterprise-live-ready (minimalt)

1. Kjør `sanity:live` mot faktisk deploy-miljø (ikke soft-skip).
2. Eventuelt utvide audit-UX per `page_id` i content-workspace (lenke finnes allerede fra feed).

## 6. Kan vente

- Dyp integrasjon media `u20id` i MediaLibraryPage.
- Kundedomeneflaten i discovery-bundle (egen risikovurdering).
