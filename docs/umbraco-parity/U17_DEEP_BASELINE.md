# U17 — Deep baseline (lesing + kartlegging)

**Dato:** 2026-03-29  
**Referanser:** [Umbraco 17 LTS](https://umbraco.com/blog/umbraco-17-lts-release/), [Umbraco AI / fleksibel fremtid](https://umbraco.com/products/flexible-foundation-for-an-ai-future/), interne CP9–CP13 + `lib/cms/**`

## 1. Nær Umbraco 17-paritet (workflow / komposisjon)

- **Kanonisk extension registry** — `lib/cms/backofficeExtensionRegistry.ts` (CP13): én manifest-liste for TopBar, palett, `sectionId`, `collectionKey`, kobling til `domainSurfaceId` / `modulePostureId`.
- **Sections** — `BackofficeNavGroupId` + `BACKOFFICE_NAV_GROUP_LABEL` (fem seksjoner).
- **Workspaces** — `BackofficeWorkspaceSurface` + `workspaceId`; innhold med paneler (content apps).
- **Historikk-fortelling** — `CmsHistoryDiscoveryStrip` (CP12), ærlig flerkilde.
- **Domain action surfaces** — `controlPlaneDomainActionSurfaces.ts` (styring vs runtime-ruting).
- **Modulposture** — `moduleLivePosture.ts` (LIMITED/STUB/DRY_RUN ærlig).
- **Uke/meny** — `operationalWeekMenuPublishChain.ts`, `week-menu` workspace uten ny menymotor.
- **AI** — modulære `app/api/backoffice/ai/**` + CI (`ai:check`, `check:ai-internal-provider`).

## 2. Under paritet (teknisk eller produkt)

- **Én historikkmotor** på tvers av Postgres / Sanity / uke — **UX** harmonisert, teknisk splittet.
- **Global fulltext-søk** — palett er filtrert liste, ikke indeks.
- **Umbraco Management/Delivery API** som produkt — LP har egne Next API + `lib/cms/public/**`.
- **Granulære node-rettigheter** som Umbraco — LP bruker roller + server guards.

## 3. Baseline «deep-dive»-fil i repo

Ingen enkeltfil funnet med navn `*deep*dive*`; baseline bygger på **CP8–CP13**, **U17**-dokumenter og **kode som sannhet**.

## 4. Åpne plattform-risikoer (gjeldende)

- Valg om **søkeprodukt** vs palett-only discovery.
- **Sanity Studio** som mutasjonspunkt for deler av meny — handoff må fortsatt være ærlig.
- **AI-kost** — operativt, ikke full dashboard i produktet.

## 5. Hva som må samles for helhetlig enterprise-CMS-følelse

- **Én kontekstfortelling** i krom (workspace + posture + styring) — **U17 DEEP** leverer `BackofficeExtensionContextStrip`.
- Samme **språk** for draft/published/preview der det finnes.
- **Ingen** ny sannhet for uke/avtale/ordre — kun lesing/review/routing.

Se `U17_DEEP_GAP_MAP.md` og `U17_REPLATFORMING_GAPS.md`.
