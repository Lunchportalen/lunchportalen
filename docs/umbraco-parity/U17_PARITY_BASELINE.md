# U17 — Parity baseline (Umbraco 17 LTS + AI)

**Dato:** 2026-03-29  
**Referanser:** [Umbraco 17 LTS](https://umbraco.com/blog/umbraco-17-lts-release/) (bl.a. LTS-stabilitet, konsistent dato/tid, moden backoffice-arkitektur), [Umbraco — AI uten å miste kontroll](https://umbraco.com/products/flexible-foundation-for-an-ai-future/)

## 1. Hva som allerede er på Umbraco-17-*lignende* nivå (workflow / control plane)

- **Én samlet backoffice-IA:** seksjoner, workspaces og content-app-lignende paneler er modellert og iterert i **CP9–CP12** (`BackofficeShell`, `BackofficeWorkspaceSurface`, palett, historikk-/discovery-strip).
- **Document-type / property-editor narrativ:** blokker, `blockFieldSchemas`, design scopes og metadata er eksplisitt dokumentert (CP10–CP11) og reflektert i `ContentWorkspace` og relaterte komponenter.
- **Publish / draft / variant:** eksisterende API og workflow-lag for innholdssider; ingen ny parallel publish-motor introdusert i senere faser.
- **Media:** backoffice media-ruter og API; discovery kobler til media uten ny lagringsmotor.
- **Uke & meny:** ærlig to-spors-modell (operativ `menuContent` vs redaksjonell `weekPlan`); CMS-side `/backoffice/week-menu` med tydelig språk (CP11).
- **AI governance i repo:** `check:ai-internal-provider`, `ai:check`, API-ruter under `app/api/backoffice/ai/**` med mønstre for kontrollert bruk; ikke «magisk» auto-publish som sannhetskilde.
- **Enterprise-guardrails:** RC-build, API-kontrakt, tenant-isolasjonstester, CMS/AI-integritetsskript — se `package.json` og eksisterende audit-rapporter.

## 2. Hva som fortsatt er under paritet (vs referanse-Umbraco 17)

- **Én teknisk historikkmotor:** Postgres, Sanity og uke/meny har fortsatt **flerkildet** spor — UX er harmonisert, men ikke én global indeksert tidslinje (CP12).
- **Global fulltext-søk:** palett og strip er navigasjon/discovery; ikke Elasticsearch-lignende global søk.
- **Load-balanced backoffice:** Umbraco 17 fremhever skalerbar backoffice; Lunchportalen er én Next-app — **arkitekturell forskjell**, ikke nødvendigvis brukerbehov-brudd.
- **Native UTC i alle lag:** delvis konsistent; full plattform-garanti krever gjennomgang per domene (se gap map).

## 3. Baseline-problemer løst siden «gammel deep-dive»

*Merk:* Ingen enkelt «deep-dive»-fil funnet i repo; baseline sammenlignes mot **CP8–CP12**-forløpet.

- **Fragmentert redaktøropplevelse** → delvis løst via **unified workspace surface**, **command palette**, **history discovery strip**.
- **Uklar publish/history for uke** → delvis løst via **eksplisitte notiser** og dokumenterte kilder (`CP11_PUBLISH_HISTORY_*`).
- **Manglende discovery** → **CP12** adresserer med palett + strip uten ny backend.

## 4. Åpne plattform-risikoer (fortsatt gjeldende)

- Valg om **søkeplattform** eller permanent **klient-only** discovery (CP12).
- **Sanity Studio** som mutasjonspunkt for deler av innhold — handoff må fortsatt være ærlig i UI.
- **AI-kost og leverandør** — avhenger av miljø og policy; governance-script hindrer intern provider-lekkasje, men full økonomisk prediksjon er operativt, ikke ren CMS-UX.

## 5. Hva som må samles under CMS control plane for LTS-moden følelse

- **Samme språk** i krom for draft/published/preview på tvers av domener.
- **Eksplisitt modulposture** (LIMITED / DRY_RUN / STUB) der runtime ikke er full — ingen «grønnvasking».
- **Routing til sikre runtime-handlinger** for transaksjonell sannhet (ordre, faktura, leveranse) — CMS eier **lesing, review, approval, publish**, ikke ordre-motor.
- **Fortsatt én visuell kontrollflate** — ingen andre «backoffice»-skall.

Se `U17_PARITY_GAP_MAP.md` for kapabilitetsliste og planlagte tiltak.
