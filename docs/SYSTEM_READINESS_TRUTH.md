# System readiness – sannhet (fasit)

**Oppdatert etter system-hardening. Beskriver hva som er 100 % kontrakt/sannhet og hva som er bevisst ikke implementert.**

## API-kontrakt (global)

- **Suksess:** `{ ok: true, rid, data }`
- **Feil:** `{ ok: false, rid, message, status, error }` (ev. detail i RC/dev)
- **404:** `jsonNotFound(rid, message)` → status 404, error NOT_FOUND

## Media backend

- **Kontrakt:** `docs/MEDIA_API_CONTRACT.md`
- GET list / GET [id] / POST (URL-basert) / PATCH: robuste, tydelige responser. 404 ved manglende element via jsonNotFound.
- **Ikke implementert:** fil-upload (multipart), DELETE, collections, move, archive. Dokumentert i kontrakten.

## Observability (editor-AI metrics)

- **Kontrakt:** `docs/OBSERVABILITY_TRUTH.md`
- Alle eventtyper (inkl. ai_error, media_error, builder_warning, content_error) mottas og persisteres i ai_activity_log. Ved insert-feil: 500 METRICS_INSERT_FAILED. Ingen stille discard.

## Health / cron / drift

- Health: runHealthChecks og tilhørende ruter; jsonOk/jsonErr. (Detaljer i lib/system og app/api/system/cron etter tilgang.)
- Cron: requireCronAuth på relevante ruter; misconfigured/forbidden/failed dokumentert i docs (f.eks. CRON_AUTH, drift/cron-error-handling).
- **Docs skal matche kode;** oppdater drift-docs ved endringer.

## AI/SEO/CRO-arkitektur

- **Page AI Contract:** `lib/cms/model/pageAiContract.ts` + `docs/ai-engine/PAGE_AI_CONTRACT.md`
- Felles felter: seo, social, intent, cro, diagnostics. Lagres i content_page_variants.body.meta. Én kilde.
- **Editor:** Full UI i «SEO & deling» (SEO + Social override) og «AI & mål» (intent, CRO, lagret diagnostikk). Roundtrip for alle kontraktfelter.
- **Persistence:** diagnostics.lastRun, diagnostics.diagnostics[] og diagnostics.suggestions[] skrives ved kjøring av diagnostikk og ved bruk av SEO/Improve-forslag.
- **AI-binding:** Improve/SEO bruker intent.audience fra kontrakten; metaSuggestion skrives tilbake; suggest-ruten godtar contract-form meta.

## Release / versjon / rollback

- **Fasit:** `docs/RELEASE_ROLLBACK_VERSION_TRUTH.md`
- App: rollback = git revert + redeploy. Innhold: **ingen** per-side versjonering eller «rollback til revisjon X». «Sett til kladd» er ikke rollback.

## Content tree

- **Fasit:** `docs/CONTENT_TREE_TRUTH.md`
- Tree er **read-only derived navigation**. Ikke persistert. CRUD (opprett/omdøp/flytt/slett) vises ikke i tree-menyen; kun navigasjon, kopier lenke og forhåndsvis. Ekte kilder: content_pages API + faste rotter.

## Hva som fortsatt ikke er 100 %

- **Content tree:** Ikke fullverdig persisted site tree (bevisst dokumentert).
- **Innholdsversjonering:** Ikke bygget (bevisst dokumentert).
- **Media:** Ingen upload/delete/collections (bevisst dokumentert).
- Eventuelle hull i health/cron-docs eller aggregering av metrics må lukkes ved videre arbeid; denne doc reflekterer kontrakts- og sannhetsstatus per siste oppdatering.
