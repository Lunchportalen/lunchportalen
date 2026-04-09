# U17 — Decision (Deep read + build)

**Dato:** 2026-03-29

## 1. Endelig beslutning

**GO WITH CONDITIONS**

- **GO:** U17 DEEP dokumenterer full mapping mot Umbraco 17-paritet (workflow/komposisjon/governance) og leverer **kontrollert** UI- og registry-forbedring (`findBackofficeExtensionForPathname`, `BackofficeExtensionContextStrip`) **uten** ny runtime-sannhet og **uten** parallell registry.
- **Betingelser:** Teknisk identitet med Umbraco/.NET, Management API/CDN-produkt som Umbraco, og én global historikkmotor — **ikke** levert; eksplisitt i `U17_REPLATFORMING_GAPS.md` og `U17_DEEP_GAP_MAP.md`.

## 2. Hva som er oppnådd

- **CMS som hovedbase:** Backoffice er kontrollflate; manifest + domain surfaces + posture registers er **koblet** i én navigasjons- og kontekstfortelling.
- **Domener som snakker med CMS:** Innhold, media, uke/meny (forklaring), SEO/social/ESG (med posture), kunder/avtale (via surfaces) — transaksjonell mutasjon forblir i **runtime** der definert.
- **Ukemeny/ukeplan:** Operativ meny via **Sanity/menuContent**-kjede uendret; redaksjonell `weekPlan` adskilt — se `U17_MENU_PUBLISH_PARITY.md`.
- **Control towers:** Fortsatt egne ruter (`/admin`, `/kitchen`, `/driver`, `/superadmin`); **innordnet** via manifest metadata og domain surfaces (routing/lesing), ikke dupliserte tårn.
- **Sections/trees/workspaces:** Modellert i `BACKOFFICE_EXTENSION_REGISTRY` med `sectionId`, `collectionKey`, `href`, `kind`; nested paths via **lengste-prefix-match**.
- **AI-governance:** Modulære API-ruter + CI-sjekker uendret; manifest **ærlig** om worker/jobb-posture; ingen ny orchestrator.

## 3. Hva som fortsatt er svakt

- Global **fulltext-søk** / indeks.
- **Én teknisk historikktidslinje** på tvers av kilder.
- **AI-innstillinger**-UI for ikke-tekniske brukere.
- Moduler **LIMITED / DRY_RUN / STUB** (social publish, worker-jobs, osv.) per `MODULE_LIVE_POSTURE_REGISTRY`.

## 4. Nærhet til Umbraco / verdensklasse

**Sterk** redaktør- og struktur-paritet (extension + section + workspace context **lesbar** i UI); **ikke** replatforming til Umbraco CMS.

## 5. Før ubetinget enterprise-live-ready (minimalt prioritert)

1. Beslutning om **søk** (indeks vs palett-only).
2. Eventuell **aggregator** for audit/historikk — egen produktfase.
3. **AI settings** / kost-innsikt — når eier prioriterer.

## 6. Kan vente

- JSON manifest export til disk.
- Global React Workspace Context.
- Avansert document-type arv.
