# CP3 — Decision

## 1. Endelig beslutning

**GO WITH CONDITIONS**

## 2. Hva som er oppnådd

- CMS fungerer tydeligere som **kontrollsenter**: `/backoffice/domains` samler runtime-tall, modulstatus, firma-innsyn og navigasjon.
- **Domener som snakker med CMS (lesing/orkestrering):** innhold/media (fra før), firma/avtale/lokasjon (via `loadDomainRuntimeOverview` + panel), uke/meny (forklart kjede + Sanity-innsyn), growth-moduler (status), tårn (lenker + narrativ).
- **Ukemeny/ukeplan:** Operativ kjede forblir `GET /api/week` + avtale + Sanity meny; `weekPlan` forblir **redaksjonelt** og merket; CMS styrer gjennom **Studio + innsikt**, ikke ny menymotor.
- **Control towers:** Innordnet via control page, TopBar og domeneindeks — operative sannheter uendret i egne apper.

## 3. Hva som fortsatt er svakt

- Worker/AI/e-post jobber: **STUB** i deler av worker.
- Middleware/API enterprise-strictness: delvis utenfor CP3 (se audit/hardening).
- To fortellinger (content publish vs Sanity meny) krever fortsatt **disiplinert** redaktør-forståelse — nå dokumentert i UI.

## 4. Hvor nær «Umbraco-nivå»

**Ærlig vurdering:** Sterkere **sammenheng og innsikt** i én flate, men ikke full **multi-tenant CMS-produktmodenhet** (workflow, revisjon på tvers, full observability) — det er **forbedringsområder**, ikke løfter i CP3.

## 5. Før ubetinget enterprise-live-ready (minimalt)

1. Lukk eller dokumenter **worker-stubs** som blokkerer drift.
2. Verifiser **API/middleware** mot siste hardening-krav.
3. Observability v1 (hendelser/alerts) etter roadmap.

## 6. Kan vente

- Visuell polering av backoffice uten semantikkendring.
- Dypere integrasjon av social publish når nøkler og policy er klare.
