# Page AI Contract – editor-UI

**Hvor kontraktsfeltene redigeres i backoffice.**

## Faner

- **SEO & deling:** seo.title, seo.description, seo.canonical (og canonicalUrl), og øvrige SEO-felter; **social.title**, **social.description** (override for deling).
- **AI & mål:** Intent (intent, audience, primaryKeyword, secondaryKeywords, contentGoals, brandTone), CRO (primaryCta, trustSignals, scannability), samt visning av lagret **diagnostics** (lastRun, diagnostics[], suggestions[]).

## Persistence

- Ved «Sidediagnostikk»: lastRun og diagnostics[] (Improve- og SEO-oppsummeringer) lagres i contract.diagnostics.
- Ved bruk av SEO- eller Improve-forslag: en kort linje appendes til contract.diagnostics.suggestions (maks 20).
- Hjelper: `app/(backoffice)/backoffice/content/_components/pageAiContractEditorUtils.ts` (appendDiagnosticsSuggestion).

## AI-binding

- intent.audience brukes som fallback når bruker ikke fyller inn målgruppe (Improve page, SEO optimize, full diagnostikk).
- metaSuggestion fra API merges tilbake i meta; suggestions persisteres ved bruk.
