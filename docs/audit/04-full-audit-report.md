# Full revisjonsrapport (`docs/audit/04-full-audit-report.md`)

**Prosjekt:** Lunchportalen  
**Revisjonsdato:** 2026-04-05  
**Omfang:** Full repo-inventar + teknisk revisjon (lesende; ingen produksjonskode endret; ingen nye pakker; ingen DB-kontakt).

---

## 1. Sammendrag

- **Prosjektstatus:** Aktiv enterprise-RC monorepo (jf. `AGENTS.md`). Arbeidsgren observeres med svært mange endrede filer — merge bør følge streng CI.
- **Hovedstack:** Next.js 15 App Router, React 19, TypeScript, Supabase (`@supabase/ssr` + `supabase-js`), Sanity, Vitest, Playwright, Tailwind, Vercel-orientert deploy (`vercel.json`).
- **Modenhet:** Høy teknisk kompleksitet (mange API-ruter, omfattende `lib/`, mange migrasjoner). God test- og script-infrastruktur; enterprise-build er eksplisitt definert.
- **Ryddighet vs fragmentering:** Kjernestruktur (`app/`, `lib/`, `supabase/`, `tests/`) er sterk. Rot-nivå har mange dokumenter og lokale artefakter; noen satellittmapper kan oppleves som historiske lag.
- **Next + Supabase:** SSR refresh i middleware via `createServerClient` + `getClaims()` stemmer overens med anbefalt `@supabase/ssr`-mønster for Next 15. Kanonisk cookie-signal er dokumentert i kode.
- **Auth-livssyklus:** Konsistent narrativ mellom `middleware.ts` og `getAuthContext()` for normal session + dev bypass; post-login rute eier landing/allowlist.
- **Merge-klarhet:** **Funksjonelt** sterkt signal (typecheck + build + målrettede auth-tester grønne lokalt), men **prosessmessig** avhengig av full CI (`build:enterprise`), full testsuite og menneskelig review gitt grenens omfang.
- **Staging-klarhet:** Krever miljø med komplett env-kontrakt (se §11 og `07-runtime-build-auth-db-analysis.md`); ikke verifisert mot remote her.

---

## 2. Omfang og metode

- **Inventert:** Alle paths under repo-rot rekursivt, inkludert skjulte mapper/filer, med `fs` traversering.
- **Traversering:** `docs/audit/tools/generate-inventory.mjs` (reproduserbar).
- **Fulltekst vs metadata:**
  - **Metadata for alt** i manifest (størrelse, type, klassifisering).
  - **Fulltekstlesing** for arkitektur- og sikkerhetsfiler (middleware, auth, supabase helpers, config, instrumentation) og utvalgte API-innganger.
  - **Ikke lest:** Innhold i `.env*` (kun eksistens/klasse), binære filer, genererte trær (`node_modules`, `.next`, `.git`, …).
- **Genererte/vendor/cache/system:** Ethvert path-segment i `{ node_modules, .git, .next, dist, build, coverage, .turbo, .vercel, out, .cache }` markerer under-tre som `generated_only`.
- **Begrensninger:** Ingen tilgang til ekstern DB/Sanity-prod; ingen SAST/DAST; `.env.example` kun delvis lesbar via shell-ekstraksjon (Cursor read nektet direkte fil-read — navn likevel hentet uten verdier).

---

## 3. Fullstendig repo-inventar

| Måling | Antall |
|--------|--------|
| Totale manifest-poster (filer + mapper) | **172 870** |
| Mapper (`type: dir`) | **19 031** |
| Filer (`type: file`) | **153 839** |
| Poster utenfor `generated_only` | **7 281** |
| Filer utenfor `generated_only` | **5 834** |
| API route handlers `app/api/**/route.ts` (ikke generert) | **568** |
| SQL-filer `.sql` (ikke generert, alle lokasjoner) | **160** |
| Migrasjoner `supabase/migrations/*.sql` | **153** |
| Vitest `tests/**/*.test.ts` | **273** |
| Vitest `tests/**/*.test.tsx` | **14** |
| Filer med `authRelated` (ikke generert) | **406** |
| `middleware.ts` (rot) | **1** |

**Utelatte paths:** Ingen ved vellykket `lstat` — alle paths i tre-filen matcher manifest.

**Top-level (alle poster inkl. generert) — dominerende områder:** `studio/` (stor, men vendor under `node_modules` klassifisert generert), `node_modules/`, `.git/`, `.next/`, deretter `lib/`, `app/`, `docs/`, `tests/`, … (se `02-file-manifest.json` `topLevelArea`).

**Utvidelser (alle filer, inkl. generert — topp fra manifest):** `.js`, `.ts`, `.map`, `(none)`, `.json`, `.md`, `.tsx`, … — dominert av `node_modules` og `.next`.

---

## 4. Full mappestruktur

- **`app/`:** App Router med route groups for app, auth, public, admin, superadmin, backoffice, portal, API under `app/api/`.
- **`lib/`:** Domene, auth, data, AI, billing, observability, m.m. — hovedlogikk.
- **`components/`:** Gjenbrukbare UI-komponenter.
- **`utils/`:** Små, kritiske hjelpere (Supabase proxy for middleware).
- **`tests/`:** Bred dekning (API, RLS, auth, CMS, runtime).
- **`docs/`:** Omfattende dokumentasjon + nå `docs/audit/`.
- **`supabase/`:** Migrasjoner og konfigurasjon.
- **`scripts/`:** CI, SEO, audit, db-verktøy.
- **`public/`:** Assets.
- **`studio/`:** Sanity Studio-prosjekt (kilde + vendor).
- **Øvrig:** `archive/`, `src/`, `domain/`, `infra/`, `k8s/`, `e2e/`, `workers/`, `evidence/`, `reports/`, m.fl.

**Avvik / historikk:** Rot-nivå har mange markdown-rapporter og logger som typisk ville bodd under `docs/` eller vært gitignored; `src/` kan overlappe konseptuelt med `app/` (avklares før refaktor).

---

## 5. Fil-for-fil-gjennomgang

Se [`06-file-by-file-review.md`](./06-file-by-file-review.md) for metode og **eksplisitte path-lister** (`parts/06a`–`06f` + `auth-related-paths.txt`). Narrativ prioritering:

- **Kritisk:** `middleware.ts`, `utils/supabase/proxy.ts`, `utils/supabase/ssrSessionCookies.ts`, `lib/auth/*`, `lib/supabase/*`, `lib/config/env*.ts`, `app/api/auth/*`.
- **Høy:** Øvrige `app/api/**`, `supabase/migrations/**`, `scripts/ci/**`, `.github/workflows/**`.
- **Støtte:** `docs/**`, `tests/**`, `public/**`.

---

## 6. Next.js-arkitektur

- **App Router** dominerer; Pages Router ikke observert som aktiv hovedbane.
- **Middleware:** `middleware.ts` med `config.matcher` som ekskluderer statiske assets; setter headers `x-pathname`, `x-url`.
- **Route handlers:** 568 `route.ts` under `app/api/`.
- **Server vs client:** `server-only` brukt på auth-kjerne; client-komponenter i `components/` og `app/**`.
- **Layouts:** Nested layouts per område (public, admin, superadmin, backoffice).
- **Instrumentation:** Node-only init av Supabase hooks + shutdown (§7 i dette dokumentet peker til `07`).
- **Edge vs node:** Middleware = edge; API routes default node (med mindre `runtime` eksport — ikke kartlagt fil-for-fil).
- **Problemområder:** Lint-advarsler i store client-filer (hooks/img) — vedlikehold og LCP, ikke nødvendigvis sikkerhet.

---

## 7. Supabase-arkitektur

Oppsummert i [`07-runtime-build-auth-db-analysis.md`](./07-runtime-build-auth-db-analysis.md) §5. **Kanonisk:** `lib/config/env.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `utils/supabase/proxy.ts`, `utils/supabase/ssrSessionCookies.ts`.

---

## 8. Auth-livssyklus (filer og flyt)

1. **Login:** `app/api/auth/login/route.ts` — etablerer session (eller lokal runtime path); logging med redacted e-post i dev.
2. **Post-login:** `app/api/auth/post-login/route.ts` — resolver `next` mot rolle-allowlist.
3. **Session:** `app/api/auth/session/route.ts` + `app/auth/session/route.ts` (legacy/parallell path observert — verifiser hvilken som er aktiv i klienter).
4. **Beskyttede sider:** `middleware.ts` kaller `updateSession` deretter sjekker cookie jar / dev bypass; ellers redirect `/login?next=…`.
5. **Server-side:** Layouts og route handlers bruker `getAuthContext()` der det er påkrevd.
6. **Logout:** `app/api/auth/logout/route.ts`.
7. **Redirect til login:** Middleware for beskyttede prefixes; post-login og login skal unngå loops (tester: `postLoginRedirectSafety`, `middlewareRedirectSafety`).

**Kanonisk session-kilde:** SSR `sb-*-auth-token*` cookies etter refresh. **Autoritativ identitetssjekk på server:** `getAuthContext()`. **Compatibility:** Bearer header for API-klienter; dev bypass cookie kun non-production. **Rolle/scope:** DB lookup + allowlist — se kildekode.

---

## 9. Middleware- og importkjedeanalyse

Detalj i [`07-runtime-build-auth-db-analysis.md`](./07-runtime-build-auth-db-analysis.md) §4. **Runtime-sikkerhet:** Observert kjede er edge-vennlig; tester bekrefter at `middleware` lastes uten å dra inn modulinit som krever Node core på kanten av importgrafen.

---

## 10. Local dev bypass

Detalj i [`07-runtime-build-auth-db-analysis.md`](./07-runtime-build-auth-db-analysis.md) §8. **Produksjon:** `NODE_ENV === "production"` blokkerer bypass. **Alignment:** Middleware og `getAuthContext` deler samme kontraktsbeskrivelse i kommentarer og kode.

---

## 11. Miljøvariabler

Kun **navn** — se tabeller og lister i [`07-runtime-build-auth-db-analysis.md`](./07-runtime-build-auth-db-analysis.md) §7. Konsistens: offentlige nøkler via `NEXT_PUBLIC_*`; service role og motor-hemmeligheter kun server.

---

## 12. Sikkerhetsgjennomgang (statisk)

- **Service role:** Begrenset til server paths (`lib/supabase/admin.ts`); må ikke importeres i klient — ikke observert i middleware.
- **Publishable key:** OK i klient/edge for Supabase; må ikke forveksles med service role.
- **Secrets til klient:** Forbudt mønster — sjekk at ingen `NEXT_PUBLIC_` eksponerer service keys (grep anbefalt i CI).
- **Admin-klient:** Skal kun brukes etter eksplisitte gates (rolle/tenant).
- **Debug-ruter:** `login-debug`, `debug/whoami`, `dev/test-order-status` (sjekker `VERCEL_ENV`) — verifiser produksjonsdekning (se `08-risk-register.md`).
- **Toppnivå evaluering:** Ikke systematisk kartlagt; middleware-importtest dekker kjent historisk issue.

---

## 13. Database- og migrasjonsstatus

- **153** migrasjoner i `supabase/migrations/`.
- **160** `.sql` filer totalt i ikke-genererte paths (inkl. dokumentasjon og tmp — skill migrasjoner fra øvrig).
- **Scripts:** `scripts/sql/`, `db:rebuild-verify`, `db:types` — operasjonelle; ikke kjørt her.
- **Vurdering:** Migrasjonsfiler er tallrike men navngitte med tidsstempel — typisk disiplinert. Ingen remote apply verifisert.

---

## 14. Build-, test- og verifikasjonsstatus

Se [`09-verification-results.md`](./09-verification-results.md).

- **typecheck:** PASS  
- **lint:** PASS (warnings)  
- **build:** PASS  
- **auth+middleware tests:** PASS (54 tester / 18 filer)  
- **Ikke kjørt:** `build:enterprise`, full `test:run`, `e2e`, `sanity:live`

---

## 15. Kvalitetsvurdering av struktur

- **Organisering:** Sterk hovedmodell; rot-nivå dokumentasjon/artefakter kan tynes.
- **Navngivning:** Konsekvent innen `app/api`; `lib/` er stor — modulære undermapper.
- **Duplikasjon:** Mulig overlapp `src/` vs `app/`, flere base URL env-variabler — dokumenter kanon.
- **Teknisk gjeld:** ESLint warnings; store klientkomponenter i backoffice.
- **Dokumentasjon:** Svært omfattende (enterprise governance).
- **Testdekning:** Bred enhets/API-dekning; e2e ikke kjørt her.
- **Operasjonell modenhet:** Scripts for SEO, audit, CI — modent; avhenger av disiplinert bruk.

---

## 16. Grønne, gule og røde funn

### Grønne

- TypeScript og standard Next build grønne lokalt. (**allerede håndtert**)
- Auth/middleware målrettede tester grønne. (**allerede håndtert**)
- Eksplisitt SSR refresh + dokumentert cookie-signal. (**god praksis**)
- `server-only` på auth-kjerne. (**god praksis**)

### Gule

- Mange ESLint-advarsler — LCP/vedlikehold. (**åpen**)
- Rot-nivå artefakter (logger, tmp sql) — rot i repo. (**åpen**)
- Flere URL/env-navn for samme konsept — dokumentasjonsbehov. (**åpen**)
- `build:enterprise` ikke kjørt i denne revisjonen. (**ikke verifisert** mot enterprise-pipeline)
- Debug API-ruter — eksponeringsrisiko avhenger av deploy. (**ikke verifisert**)

### Røde

- Ingen røde **kompilerings**- eller **målrettede auth-test**-feil observert i kjøringene.
- **Prosess:** Stor endringsflate på gren uten full CI-kjøring her — **merge-risk** (kategoriseres som rød *prosess* hvis merges uten `build:enterprise` + full test).

---

## 17. Anbefalt målstruktur (ikke implementert)

- **Kanonisk:** Behold `middleware.ts`, `utils/supabase/proxy.ts`, `lib/auth/getAuthContext.ts`, `lib/supabase/admin.ts`, `lib/config/env.ts`.
- **Rydde:** Flytt rot-nivå `*.md` reportfiler til `docs/reports/` eller arkiver; fjern `.tmp*` fra VCS om de ikke trengs.
- **Avklar:** `app/auth/session` vs `app/api/auth/session` — dokumenter hvilken som er offisiell.
- **Fase ut:** Avhengigheter fra `archive/` og ubrukte eksempel-ruter etter bekreftelse.
- **Først videre:** Kjør `build:enterprise` + full `test:run` + e2e på staging før merge av stor gren.

---

## 18. Dette trenger en ekstern rådgiver videre

Se [`10-external-advisor-package.md`](./10-external-advisor-package.md).

---

## 19. Kort konklusjon

| Spørsmål | Svar |
|----------|------|
| Er repoet på riktig vei? | **Ja** arkitektonisk (App Router + Supabase SSR + tydelig auth-kjerne), med behov for streng CI/disiplin på rot og store grener. |
| Supabase SSR-oppsett riktig i hovedsak? | **Ja** — refresh i middleware + cookie jar signal er konsistent dokumentert. |
| Auth-livssyklus konsistent? | **Ja** mellom middleware og `getAuthContext` for documented paths; **verifiser** eventuelle parallelle session-ruter. |
| Middleware-importkjede runtime-sikker? | **Ja** i gjennomgått kjede + eksisterende test. |
| Local dev bypass trygg i prod? | **Ja** gitt `NODE_ENV=production` i deploy — eksplisitt gate. |
| Merge-klart? | **Funksjonelt sterkt signal**; **prosessmessig** avhengig av full enterprise CI og review. |
| Staging-klart? | **Krever** komplett env + smoke flows — ikke bekreftet her. |

**Fem viktigste neste steg:**

1. Kjør `npm run build:enterprise` og full `npm run test:run` på CI eller lokalt med RC_MODE.  
2. Kjør Playwright mot staging.  
3. Gjennomgå og evt. lås ned debug-ruter i produksjon.  
4. Rydd rot-nivå tmp/logger-filer og stram `.gitignore` der nødvendig.  
5. Dokumenter kanonisk env-liste (navn) utover `.env.example` — én sannhetskilde for onboarding.

---

## Dekningskontroll (obligatorisk)

- Alle paths i `01-repo-tree-full.txt` finnes i `02-file-manifest.json` — tellinger like (**172 870**).  
- Alle top-level områder omtalt i `05-top-level-directories.md` eller klassifisert som generert.  
- Auth-relaterte filer eksplisitt listet i `parts/auth-related-paths.txt` (406 filer).  
- SQL/migrasjoner telt (§3).  
- Testmapper inventert (`tests/`, `e2e/` i manifest + glob-tall).

**Utelatte paths:** *Ingen* ved vellykket skann.
