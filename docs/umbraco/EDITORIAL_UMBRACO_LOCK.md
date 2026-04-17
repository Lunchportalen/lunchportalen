# Editorial truth lock — Umbraco for allowlisted public routes

**Scope:** Marketing forsiden (`/`, slug `home`) og allowlistede undersider. **Supabase er ikke redaksjonell sannhet** for disse slugsa.

**Ikke-scope:** Sanity (meny/plan), Supabase operativ sannhet, auth, bestilling. Supabase **published** rows leses kun via `readSupabasePublishedContentPageBySlug` (backoffice), ikke via public `getContentBySlug`.

## 1. Env (permanent aktiv Delivery)

- `UMBRACO_DELIVERY_BASE_URL` — **påkrevd** for at `getContentBySlug` skal returnere `live-umbraco` for allowlistet slug. Uten denne: `null` for allowlistet slug (fail-closed), deretter seed i loader.
- Valgfritt: `UMBRACO_DELIVERY_API_KEY`, `UMBRACO_DELIVERY_START_ITEM`, `LP_MARKETING_UMBRACO_EXTRA_SLUG`

`LP_MARKETING_CMS_SOURCE` er **ikke** gate for public read (legacy / dokumentasjon kan fortsatt nevne den).

## 2. Umbraco-redigering

Noder som matcher Delivery `…/content/item/{slug}` for allowlistede slugs (`lib/cms/umbraco/marketingAdapter.ts` — `marketingUmbracoAllowlistedSlugs()`). Allowlisten inkluderer **alle** stier i `lib/seo/marketing-registry.json` (mappet til URL-slug, `/` → `home`), pluss `faq`, `registrering`, og `LP_MARKETING_UMBRACO_EXTRA_SLUG`.

## 3. Publisering

Publiser i Umbraco slik at Delivery returnerer innhold for aktuell slug.

## 4. Routes

- `/` — forsiden
- `/om-oss`, `/kontakt`, `/personvern`, `/vilkar`, `/faq`, `/registrering`, ev. extra slug (`LP_MARKETING_UMBRACO_EXTRA_SLUG`, default `phase1-demo`)
- `/registrer-firma` → permanent redirect til `/registrering` (Next `redirects` i `next.config.ts`)
- Dynamisk `app/(public)/[slug]/page.tsx` for andre slug som går gjennom samme loader

## 5. DOM

- Forside: `div.lp-home[data-lp-public-cms-slug="home"][data-lp-public-cms-origin]`
- Øvrige marketing-sider via `PublicCmsSlugPageView`: `article[data-lp-public-cms-slug][data-lp-public-cms-origin]`
- `/kontakt` og `/registrering`: wrapper `div` med `data-lp-public-cms-slug` + `data-lp-public-cms-origin`

**Verifikasjon:** `data-lp-public-cms-origin` skal speile faktisk runtime-kilde (`live-umbraco` når Delivery leverer innhold; `seed-no-row` / `seed-empty-body` ved fail-closed; `local-cms` / `local-reserve` kun i dev/harness). **`live-supabase` forekommer ikke** på allowlistede marketing-sider.

## 6. Metadata

- **Én kjede:** `generatePublicCmsSlugMetadata` (i `lib/cms/public/publicCmsSlugRoute.tsx`) leser samme `loadPublicPageWithTrustFallback` → `buildCmsPageMetadata` når innhold er live; **alle** eksplisitte marketing-sider + dynamisk `[slug]` + `/kontakt` + `/registrering` bruker denne (ingen separat hardkodet Next-SEO som primærkilde).
- **Live Umbraco:** `buildCmsPageMetadata` fra body (samme kilde som blokker).
- **Mangler editorial rad / ukjent slug:** `buildEditorialFailClosedMetadata` (via `canonicalPathForPublicEditorialSlug`) — kort teknisk beskrivelse, `noindex` (ikke «Siden finnes ikke» som falsk 404-SEO).
- **Seed / fail-closed:** `buildEditorialFailClosedMetadata` — kort teknisk beskrivelse, `noindex`.
- **JSON-LD:** `PublicCmsStructuredData` / `buildPublicCmsJsonLdGraph` (i `components/seo/CmsStructuredData.tsx`) bruker **samme `title` + `body`** som blokker og metadata. Ved seed/fail-closed (`lp_editorial_fallback` i body) settes beskrivelse til den tekniske fail-closed-linjen — ikke «rik» marketing. FAQ-schema legges kun til når `body.meta` har gyldige Q/A; ugyldig data hopper over (ingen kast). Forsiden bruker `CmsStructuredData` (= `canonicalPath` `/`).

## 7. Verifikasjon

1. **Prod runtime må ikke maskere Delivery:** `LP_CMS_RUNTIME_MODE` skal være **unset** eller eksplisitt `remote` / `remote_backend` (default i `getCmsRuntimeStatus`). Verdier som aktiverer `local_provider` eller `reserve` overstyrer Umbraco og er **kun** for lokal/dev — ikke «live publish»-bevis.
2. Sett `UMBRACO_DELIVERY_BASE_URL` mot gyldig Delivery-endepunkt (kilde for `live-umbraco`).
3. Valgfritt men typisk i prod: `UMBRACO_DELIVERY_API_KEY`, `UMBRACO_DELIVERY_START_ITEM` slik at `GET …/content/item/{slug}` returnerer 200 for publiserte noder.
4. Rediger og **publiser** i Umbraco for noden som matcher allowlistet `routeSlug` (samme som URL-slug: `home`, `om-oss`, `kontakt`, `personvern`, `vilkar`, `faq`, `registrering`, pluss `LP_MARKETING_UMBRACO_EXTRA_SLUG` standard `phase1-demo`).
5. Åpne `/`, `/om-oss`, `/kontakt`, `/personvern`, `/vilkar` — i **View source** eller devtools: `data-lp-public-cms-origin="live-umbraco"`. `<meta name="robots">` skal **ikke** være `noindex` fra `buildEditorialFailClosedMetadata` når innholdet er live.
6. Endre en synlig tekstblokk i Umbraco, publiser, hard refresh / vent cache — innholdet skal reflektere endringen uten deploy (Delivery `cache: no-store` i `fetchMarketingFromUmbracoBySlug`).
7. Simuler feil (feil base URL eller slettet node): forvent `seed-no-row` / `seed-empty-body`, `noindex`, og kort fail-closed description — **ikke** rik hardkodet marketing som «skjult live».

### 7c. Når produksjonsbevis blokkeres (Vercel / hosting)

Hvis `https://www.lunchportalen.no` (eller apex `https://lunchportalen.no`) returnerer **HTTP 402** med **`X-Vercel-Error: DEPLOYMENT_DISABLED`**, svarer **Vercels edge** med en **plaintxt-feil** — **Next.js kjører ikke**, og det finnes **ingen HTML** å lese (`deploy-blocked` / `no-html` for runtime-verifikasjon).

**Dette er ikke forårsaket av** `vercel.json` (kun crons + `ignoreCommand`), **`next.config.ts`**, eller app-kode. `DEPLOYMENT_DISABLED` betyr at **deployment til domenet er deaktivert eller ikke tilgjengelig** i Vercel-prosjektet (f.eks. paused deployment, slettet/sperret produksjonsdeployment, kontobegrensning). **Løsning ligger i Vercel Dashboard** (aktiver gjenoppta deploy, koble domene til aktiv deployment, fakturering/tilgang) — **ikke** ved å endre denne repo-fila alene.

**Etter 200 HTML:** kjør `npm run verify:production-public-cms` — forvent `data-lp-public-cms-origin` og evt. `VERIFY_STRICT_LIVE_UMBRACO=1` for `live-umbraco` (krever i tillegg `UMBRACO_DELIVERY_BASE_URL` + publiserte Umbraco-noder i det miljøet).

## 7b. Ruter utenfor redaksjonell marketing-HTML

**Marketing-/landingssider** fra `marketing-registry.json` rendres via samme Delivery-pipeline (`PublicCmsSlugPageView` / `loadPublicPageWithTrustFallback`). **`marketing-registry.json` er ikke redaksjonell runtime-sannhet:** den brukes til **allowlist**-generering (via `marketingAdapter`), **sitemap** (`app/sitemap.ts`), **intent/RelatedLinks** — ikke som primær kilde til HTML, `generateMetadata` eller JSON-LD. Tittel/beskrivelse i JSON-filen erstatter ikke Umbraco-body i runtime.

Tidligere kode-eide demo-flater (`/pitch`, `/investor`, tidligere `/public/demo`) er flyttet til samme pipeline; `/public/demo` redirectes permanent til `/ai-motor-demo` (kanonisk slug `ai-motor-demo`).

**Fortsatt ikke marketing-CMS:** operative flater (`/status`, produkt-attribution redirect, login, app/saas, ukevisning, osv.) — ikke public editorial scope.

**Registrering:** `/registrering` har **Umbraco-styrt** presentasjon/SEO når Delivery leverer blokker; skjema/innsending er **operativ** (Supabase) via `PublicRegistrationFlow` — samme mønster som kontaktskjema under `/kontakt`.

## 8. Tester

- `tests/cms/umbracoMarketingAdapter.test.ts` — allowlistet miss, manglende base-URL, public resolver vs intern DB-leser.
- `tests/cms/umbracoPublishLiveChain.test.ts` — allowlist-paritet (hva som er Delivery-styrt vs ikke).
- `tests/cms/marketingRegistryAllowlistParity.test.ts` — alle `marketing-registry.json`-stier har Delivery-slug.
- `tests/cms/publicEditorialTruth.test.ts`, `tests/cms/editorialFailClosedMetadata.test.ts`
- `tests/cms/publicCmsJsonLdTruth.test.ts` — JSON-LD-graph fra samme body som metadata; seed kaster ikke
- `scripts/verify-production-public-cms.mjs` — **manuell** HTTP+DOM-sjekk mot prod (kjører ikke automatisk i CI)

Se `docs/umbraco/FOUNDATION2_HOME_TRUTH.md`.
