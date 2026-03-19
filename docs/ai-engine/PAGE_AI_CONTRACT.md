# Page AI Contract

**Én sannhetskilde for side-nivå AI/SEO/CRO-felter. Implementasjon: `lib/cms/model/pageAiContract.ts`.**

## Plassering

- Lagres i **content_page_variants.body.meta** (samme envelope som `blocks`). Ingen egne kolonner; alt i JSON.
- Typene: `PageAiContract`, `PageAiSeo`, `PageAiSocial`, `PageAiIntent`, `PageAiCro`, `PageAiDiagnostics`.

## Felt (alle valgfrie)

| Nøkkel under meta | Bruk |
|-------------------|------|
| **seo** | title, description, canonical |
| **social** | title, description (override for og/twitter) |
| **intent** | intent, audience, primaryKeyword, secondaryKeywords, contentGoals, brandTone |
| **cro** | primaryCta, trustSignals, scannability (CRO-lag) |
| **diagnostics** | lastRun, diagnostics[], suggestions[] (siste kjøring) |

## Bruk i repoet

- **ContentWorkspace / AI-verktøy:** Les og skriv `meta.seo`, `meta.intent`, `meta.diagnostics` i stedet for ad-hoc felter. `buildAiMeta(meta)` kan utvides til å mappe fra `PageAiContract`.
- **Improve page / SEO optimize / page builder:** Skriv til `meta.seo`, `meta.intent`, `meta.diagnostics` slik at neste kjøring og UI har én konsistent struktur.
- **CRO:** Når CRO-verktøy bygges, bruk `meta.cro`; ikke opprett parallelle strukturer.

## Vedlikehold

- Nye felter: legg til i `pageAiContract.ts` og oppdater denne doc. Ikke dupliser feltnavn i andre moduler.

## Integrasjon (implementert)

- **Lagring/lasting:** body.meta lagres og lastes som før; `parseMetaToPageAiContract` / `mergeContractIntoMeta` (lib/cms/model/pageAiContractHelpers.ts) brukes for trygg parse og merge uten å fjerne andre nøkler (nav, scripts, osv.).
- **Editor:** SEO-felter (title, description, canonical) og Social override (social.title, social.description) i fanen «SEO & deling». Fanen «AI & mål»: intent (intent, audience, primaryKeyword, secondaryKeywords, contentGoals, brandTone), CRO (primaryCta, trustSignals, scannability), samt visning av lagret diagnostikk (lastRun, diagnostics[], suggestions[]). Canonical synkroniseres med canonicalUrl for bakoverkompatibilitet.
- **Diagnostics/suggestions persistence:** Full diagnostikk skriver lastRun og diagnostics[] (Improve- og SEO-oppsummeringer) til contract.diagnostics. Ved bruk av SEO- eller Improve-forslag appendes en kort linje til contract.diagnostics.suggestions (maks 20).
- **AI-verktøy:** Improve page / SEO optimize mottar meta fra kontrakten (buildAiMeta → contractToAiMetaShape). metaSuggestion fra API merges tilbake i meta; intent.audience fra kontrakten brukes når bruker ikke fyller inn målgruppe. Suggest-ruten godtar både flat meta og contract-form (inputMetaToAiContext).
- **CRO:** primaryCta, trustSignals, scannability har editor-UI i «AI & mål» og roundtrippes i meta.cro.
- **Fallback:** parseMetaToPageAiContract håndterer manglende/ufullstendig meta; mergeContractIntoMeta endrer kun kontraktnøkler. Ukjente felter beholdes ved lagring.
