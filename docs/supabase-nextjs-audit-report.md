# Supabase + Next.js — teknisk revisjonsrapport (repo-only)

**Prosjekt:** Lunchportalen  
**Dato:** 2026-04-05  
**Omfang:** Statisk gjennomgang av kildekode og mappestruktur. Ingen kjøring mot remote database, ingen hemmeligheter eller env-verdier er inkludert.

---

## 1. Sammendrag

- **Status:** Appen er et **Next.js 15 App Router**-prosjekt med **TypeScript**, **React 19**, og offisielle pakker **`@supabase/ssr`** + **`@supabase/supabase-js`**. Det finnes **ingen** `@supabase/auth-helpers-*`-avhengigheter i `package.json`.
- **Supabase SSR:** Kjernemønsteret følger **Supabase-anbefaling for App Router**: `createBrowserClient` i nettleser, `createServerClient` med cookie-adapter på server, og **sesjonsoppdatering i `middleware.ts`** via `createServerClient` + `auth.getClaims()` (`utils/supabase/proxy.ts`). Dette vurderes som **i hovedsak riktig** for Next.js 15.
- **Risiko / kompleksitet:** I tillegg til standard SSR-cookies brukes **egendefinerte httpOnly-cookies** (`sb-access-token`, `sb-refresh-token`) for middleware-beskyttelse og en **Bearer-fallback** i `lib/supabase/server.ts`. Det gir **to parallelle spor** for autentisering som en rådgiver bør forstå og eventuelt forenkle.
- **App Router + Supabase:** `app/`-struktur, route handlers og server components er konsistent med typisk Supabase SSR-bruk. `instrumentation.ts` kaller `initSupabaseServerHooks()` for best-effort admin-RPC (service role).

---

## 2. Teknisk grunnlag

### 2.1 Relevante avhengigheter (`package.json`)

| Pakke | Versjon |
|--------|---------|
| `next` | `15.5.10` |
| `react` | `^19.2.3` |
| `react-dom` | `^19.2.3` |
| `@supabase/ssr` | `^0.8.0` |
| `@supabase/supabase-js` | `^2.47.6` |
| `server-only` | `^0.0.1` |

- **Auth-helpers:** ikke funnet (ingen `@supabase/auth-helpers-nextjs` e.l.).
- **TypeScript:** ja (`typescript` `^5.9.3`, `npm run typecheck` = `tsc --noEmit`).
- **App Router:** ja (`app/` brukes som primær ruteflate).
- **Middleware:** ja — rot `middleware.ts`.
- **Root `proxy.ts` (Next.js 16+):** **ikke funnet**. `middleware.ts` kommenterer at migrering til `proxy.ts` kan vurderes ved oppgradering.
- **`supabase/`-mappe:** ja (bl.a. `supabase/migrations/`).
- **`supabase/migrations`:** ja.
- **`utils/supabase/`:** ja (`client.ts`, `server.ts`, `proxy.ts`, `publicEnv.ts`).
- **`lib/supabase/`:** ja (`admin.ts`, `server.ts`, `client.ts`, `browser.ts`, `route.ts`, `init.ts`, `ensureRpc.ts`, `adminAny.ts`).

### 2.2 Merknad om `.env.example`

Fila `.env.example` kunne **ikke leses** i revisjonsmiljøet (tilgang nektet). **Alle env-navn** i denne rapporten er utledet fra **faktisk bruk i kodebase** (grep), ikke fra eksempelfil.

---

## 3. Relevant filtre (kort tre)

```
lunchportalen/
├── package.json
├── tsconfig.json
├── middleware.ts
├── instrumentation.ts
├── app/
│   ├── api/…                    # mange route handlers (auth, orders, superadmin, backoffice, …)
│   ├── (app)/…                  # innlogget employee-flater
│   ├── (auth)/…
│   ├── admin/ … superadmin/ … backoffice/ …
│   └── auth/…                   # f.eks. app/auth/session/route.ts
├── lib/
│   ├── config/
│   │   ├── env.ts               # server-only, inkl. Supabase public config
│   │   └── env-public.ts        # klient-sikker public Supabase + local runtime
│   ├── supabase/
│   │   ├── admin.ts
│   │   ├── server.ts
│   │   ├── client.ts
│   │   ├── browser.ts
│   │   ├── route.ts
│   │   ├── init.ts
│   │   ├── ensureRpc.ts
│   │   └── adminAny.ts
│   └── …
├── utils/
│   └── supabase/
│       ├── client.ts
│       ├── server.ts
│       ├── proxy.ts             # updateSession for middleware
│       └── publicEnv.ts         # edge/browser-safe public credentials
├── supabase/
│   └── migrations/*.sql         # 153 filer (telt 2026-04-05)
└── scripts/
    ├── sql/                     # f.eks. seed (ikke migrations)
    ├── ci/db-rebuild-verify.mjs
    ├── db/run-health-audit.mjs
    └── apply-forward-fix-migrations.mjs
```

**Utelatt:** `node_modules/`, stor del av `docs/` utenom denne rapporten, mesteparten av `app/` detaljert.

**Ikke funnet:**

- `utils/supabase/middleware.ts` (kun `proxy.ts` brukes fra rot-`middleware.ts`).
- Rot `proxy.ts`.

---

## 4. Supabase-arkitektur (filbasert)

| Rolle | Hvor opprettes | Teknologi / notat |
|--------|----------------|-------------------|
| **Browser-klient** | `utils/supabase/client.ts` | `createBrowserClient` fra `@supabase/ssr`, singleton, `getSupabasePublicCredentials()` fra `utils/supabase/publicEnv.ts`. |
| **Server (RSC / actions) cookie-klient** | `utils/supabase/server.ts` | `createServerClient` + `next/headers` `cookies()`; creds fra `getSupabasePublicConfig()` i `lib/config/env.ts`. |
| **Middleware refresh** | `utils/supabase/proxy.ts` | `createServerClient` på request/response; `setAll` bygger ny `NextResponse.next` og setter cookies; **`await supabase.auth.getClaims()`** for refresh. |
| **Route handlers (Request/Response)** | `lib/supabase/route.ts` | `createServerClient` med cookies fra `Cookie`-header og `res.cookies.set`. |
| **Orkestrert server-klient** | `lib/supabase/server.ts` → `supabaseServer()` | Bruker SSR-cookie-klient når `sb-*auth-token*`-cookies finnes; ellers `createClient` fra `@supabase/supabase-js` med **`Authorization: Bearer <sb-access-token>`** hvis den finnes; ellers faller tilbake til SSR-klient. |
| **Service role** | `lib/supabase/admin.ts` → `supabaseAdmin()` | `createClient` med `SUPABASE_SERVICE_ROLE_KEY`; `server-only`; prosess-singleton `_admin`. |
| **Alternativ service client** | `lib/cms/globalSettingsAdmin.ts` | Egen `createClient` med service role (duplikat mønster, se sikkerhet). |

**Cookies**

- **Supabase SSR:** standard chunked cookies håndteres av `@supabase/ssr` via `setAll` i middleware og server-klient.
- **Custom:** `sb-access-token` og `sb-refresh-token` settes i bl.a. `app/api/auth/post-login/route.ts` og `app/api/auth/login/route.ts`; middleware sjekker **kun** `sb-access-token` for å avgjøre om beskyttet rute skal sendes til `/login`.

**Auth / refresh**

- **Middleware:** `updateSession` → `getClaims()` utløser oppdatering av sesjon der biblioteket finner det nødvendig.
- **Post-login:** tokens i body → httpOnly custom cookies → `createServerClient` + `setSession`.
- **Bred bruk av `getUser()`** i server components og API-ruter (grep viser mange kall); **`getSession()`** brukes noen steder i klientkode (f.eks. `AcceptInviteClient`, `AuthStatus`, admin test-klient).

**Flere `createClient`-implementasjoner**

- Ja, men med **tydelig rollefordeling**: browser (`utils/supabase/client`), SSR server (`utils/supabase/server`), middleware (`proxy.ts`), route (`lib/supabase/route.ts`), bearer-fallback + admin (`lib/supabase/server.ts` / `admin.ts`), pluss **ekstra** service-klient i `lib/cms/globalSettingsAdmin.ts`.

**Overlap `utils/supabase` vs `lib/supabase`**

- **`utils/supabase`:** lavnivå SSR/browser + **edge-safe** `publicEnv` (brukes i middleware).
- **`lib/supabase`:** appens **fasade** (`supabaseServer`, `supabaseAdmin`, re-exports) og route-helper. **Ikke ren duplikasjon**, men **to lag** som rådgiver bør behandle som kontrakt: endringer bør konsolideres i én «sann» implementasjon per lag.

---

## 5. Miljøvariabler (kun navn, ingen verdier)

| Variabel | Browser-safe? | Typisk bruk / notat |
|-----------|---------------|---------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ja (eksponeres i bundle) | URL overalt (publicEnv, env.ts, mange routes, klientkomponenter). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ja | Primær «anon/publishable» i `lib/config/env.ts`, `lib/config/env-public.ts`, `utils/supabase/publicEnv.ts`. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | ja | **Legacy fallback** (samme tre steder som over). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ja | **Legacy fallback** + fortsatt **direkte krav** i flere filer (se teknisk gjeld). |
| `SUPABASE_URL` | server | `lib/supabase/admin.ts` (foretrukket server-URL), `lib/cms/globalSettingsAdmin.ts`, scripts/tests. |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | `lib/supabase/admin.ts`, `lib/cms/globalSettingsAdmin.ts`, integrasjonstester, diverse `lib/*` og `app/api/*` via `supabaseAdmin()`. |
| `DATABASE_URL` | server/CI | `scripts/ci/db-rebuild-verify.mjs`, `scripts/db/run-health-audit.mjs`, `scripts/ci/db-contracts.mjs` (valgfritt). |
| `SUPABASE_DB_PASSWORD` | server (operasjonelt) | `scripts/apply-forward-fix-migrations.mjs` (alternativ til direkte `DATABASE_URL`). |
| `DB_PASSWORD` | server | Samme script som fallback-navn. |
| `RUN_SUPABASE_INTEGRATION_TESTS` / `VITEST_SUPABASE_INTEGRATION` | test | `tests/_helpers/remoteSupabaseIntegration.ts`. |
| `LP_LOCAL_CMS_RUNTIME` / `LOCAL_CMS_RUNTIME_MODE` | server/build | `lib/localRuntime/runtime.ts` — styrer «local provider»; påvirker `env-public.ts` for public config. |

**Konsistens / teknisk gjeld**

- **Splittelse mellom** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` **og** `NEXT_PUBLIC_SUPABASE_ANON_KEY`: kjerneutils støtter begge, men **enkelte routes** (`app/api/auth/post-login/route.ts`, `app/api/order/*`, `app/auth/session/route.ts`, m.fl.) leser **kun** `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Det øker risiko for feilkonfigurasjon hvis bare «publishable»-navnet er satt i miljøet.

---

## 6. Sikkerhetsgjennomgang

- **Service role i browser:** **Ikke observert** i `.tsx` med `use client` som importerer `supabaseAdmin`. Treff på `supabaseAdmin` i `.tsx` er **async server components** (`AgreementBlock`, dynamisk import i `week/page.tsx`) — **OK** så lenge de ikke importeres inn i klientbundne moduler.
- **Service role i middleware:** **Nei** — middleware bruker kun **anon/publishable** via `getSupabasePublicCredentials()`.
- **Service role i dedikerte server-moduler:** **Ja** — primært `lib/supabase/admin.ts` og kallkjeder derfra; **unntak:** `lib/cms/globalSettingsAdmin.ts` bygger **egen** service-klient (samme hemmelighet, annen singleton).
- **Potensielt farlige mønstre:** Unngå å importere `@/lib/supabase/admin` fra komponenter som kan ende i klientbundle; per nå ser **AgreementBlock** og **week** ut til å være server-only.
- **Publishable/anon i middleware:** Bruker `utils/supabase/publicEnv.ts` — **OK** for edge (ingen `server-only`).
- **Debug / observability:** `app/api/debug/whoami/route.ts` eksponerer **boolsk** tilstedeværelse av URL/anon (ikke verdier) — fortsatt noe som bør vurderes i produksjon (informasjonslekkasje om konfigurasjon).

---

## 7. SSR- og auth-flyt (praktisk)

1. **Browser:** Login flyter typisk via API; klient kan bruke `utils/supabase/client` eller direkte `process.env.NEXT_PUBLIC_*` i noen auth-komponenter. Session i URL håndteres av `createBrowserClient`-opsjoner.
2. **Middleware (`middleware.ts`):** For ikke-bypassede stier kalles `updateSession` → Supabase oppdaterer cookies → for **beskyttede prefiks** sjekkes **`sb-access-token`**; mangler den → redirect `/login?next=…`. API mesteparten **bypasses** (unntak bl.a. `post-login`, `logout`, `login`).
3. **Server Components:** `supabaseServer()` fra `lib/supabase/server.ts` → enten SSR cookies eller Bearer fra `sb-access-token` → `getUser()` vanligvis.
4. **Route handlers:** Ofte `supabaseServer()`, `supabaseRoute(req,res)`, eller `supabaseAdmin()` avhengig av behov.
5. **Admin/server-only:** `supabaseAdmin()` for RLS-bypass og batch-jobber; `ensureRpcReady()` ved oppstart (instrumentation) hvis admin-config finnes.

**Filer som bør leses sammen:** `middleware.ts`, `utils/supabase/proxy.ts`, `app/api/auth/post-login/route.ts`, `lib/supabase/server.ts`, `utils/supabase/server.ts`.

---

## 8. Database- og migrasjonsstatus i repo

| Funn | Detalj |
|------|--------|
| `supabase/migrations/` | **153** `.sql`-filer (telt 2026-04-05). |
| SQL andre steder | Bl.a. `scripts/sql/seed_home_cms.sql`; diverse `scripts/*.mjs` som bruker `DATABASE_URL`. |
| Struktur | **Versjonerte migrasjoner** med tidsstempel-prefiks — **ryddig standard** for Supabase CLI. |
| Ikke-migrasjons-SQL | `scripts/apply-forward-fix-migrations.mjs` beskriver **engangs/forward-fix** flyt — **ikke** en del av standard `migrations/`-pipeline; bør merkes som **operasjonelt script**, ikke «normal migrasjon». |
| Mangler? | Full **sannhet** om produksjons-DB krever remote/CLI; repoet ser **komplett ut** med stor migrasjonsflate. `supabase/.temp/` i workspace tyder på **lokal CLI-kjøring** (typisk ikke kilde-sannhet). |

---

## 9. Kvalitetskontroll (kjørt lokalt i repo)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | **PASS** (`tsc --noEmit`, exit 0). |
| `npm run lint` | **PASS** med **warnings** (hooks, `no-img-element`, m.m.). **Ingen** lint-feil observert i denne kjøringen. |

**Supabase/Next-relatert i lint-output:** **Ingen** tydelige treff; advarsler er primært React hooks og bilder i backoffice/public demo.

---

## 10. Fil-for-fil-rapport

| Fil | Vurdering |
|-----|-----------|
| `utils/supabase/client.ts` | **Behold.** Kanonisk browser-klient med `@supabase/ssr`. |
| `utils/supabase/server.ts` | **Behold.** Cookie-bundet `createServerClient` for RSC/server actions. |
| `utils/supabase/proxy.ts` | **Behold.** Middleware refresh + `getClaims()` — sentral for SSR. |
| `utils/supabase/middleware.ts` | **Ikke funnet.** |
| `lib/supabase/client.ts` | **Behold** som tynn re-export mot `utils` (klar import for app-kode). |
| `lib/supabase/server.ts` | **Behold**; **dokumenter** Bearer-fallback og custom cookies for rådgivere. |
| `lib/supabase/browser.ts` | **Valgfri** — merket legacy shim; kan fases ut når alle kall bruker `lib/supabase/client`. |
| `lib/supabase/admin.ts` | **Kanonsk** service-role inngang; **behold**. |
| `middleware.ts` | **Behold**; viktig for refresh + route-guard; forstå forholdet `sb-access-token` vs Supabase SSR-cookies. |
| `proxy.ts` (rot) | **Ikke funnet** (Next 16+ evt. senere). |
| `lib/config/env.ts` | **Behold** som server-only sannhet for public Supabase + Sanity. |
| `lib/config/env-public.ts` | **Behold** for klient-sikker tilgang + local runtime; ikke importer i `server-only`-kjeder unødig. |
| **App-sider / API som bruker Supabase** | Stort sett konsistent `supabaseServer()` / `getUser()`; unntak er direkte `NEXT_PUBLIC_SUPABASE_ANON_KEY` i enkelte routes (bør harmoniseres). |

---

## 11. Funn og anbefalinger

### Grønne funn

- Bruk av **`@supabase/ssr`** med `createServerClient` / `createBrowserClient` er **på linje med dokumentasjon** for App Router.
- **Middleware** oppdaterer sesjon og returnerer `NextResponse` korrekt via `updateSession`.
- **Service role** er isolert til **`server-only`** moduler i hovedarkitekturen (`lib/supabase/admin.ts`).
- **Migrasjonskatalog** er stor men **strukturert** under `supabase/migrations/`.
- **Typecheck** passerer.

### Gule funn (teknisk gjeld / forbedringer)

- **To spor for auth:** SSR cookies + `sb-access-token` Bearer + custom refresh-cookie — **økt kompleksitet** og risiko for edge cases ved token-utløp/refresh.
- **Flere lesere av anon/publishable key** med **ulike navn** (`PUBLISHABLE_*` vs `ANON_KEY`).
- **Duplikat service-role factory** i `lib/cms/globalSettingsAdmin.ts` vs `lib/supabase/admin.ts`.
- **`adminAny.ts`:** tynn wrapper — vurder om den trengs eller bør konsolideres.

### Røde funn (risiko — avhengig av drift / produksjon)

- Middleware tillater passasje til beskyttede ruter når **`sb-access-token` finnes** uten validering i middleware; **ugyldig token** kan gi **inkonsistent UX** (inn passert middleware, feilet `getUser()` i RSC). **Ikke nødvendigvis** privilege-escalation, men **forutsigbarhetsrisiko**.
- **`app/api/debug/whoami`** og liknende bør **hard-gates** i produksjon (ikke verifert her).

### Anbefalt målstruktur (konseptuelt)

1. **Ett lag «infra»:** `utils/supabase/*` (browser, server, middleware helper, publicEnv).  
2. **Ett lag «app API»:** `lib/supabase/*` (facade: `supabaseServer`, `supabaseAdmin`, `supabaseRoute`).  
3. **Én service-role fabrikk:** kun `lib/supabase/admin.ts`; øvrige moduler bruker den.

### Kanoniske filer

- Browser: `utils/supabase/client.ts` (via `lib/supabase/client.ts`).  
- Server SSR: `utils/supabase/server.ts` + `lib/supabase/server.ts`.  
- Middleware refresh: `utils/supabase/proxy.ts`.  
- Admin: `lib/supabase/admin.ts`.

### Fase ut / slå sammen

- `lib/supabase/browser.ts` når importene er oppdatert.  
- Egen service-klient i `lib/cms/globalSettingsAdmin.ts` → bruk `supabaseAdmin()` eller delt intern helper.

### Hva bør gjøres først (uten implementasjon nå)

1. **Harmonisere env-navn** for publishable key i alle auth/order routes.  
2. **Dokumentere og teste** token-utløp-scenario for middleware + RSC + post-login.  
3. **Konsolidere service-role** til én modul og gjennomgå alle `supabaseAdmin()`-kall for tenant/RLS-policy.

---

## 12. Dette trenger en ekstern rådgiver videre

**Filer å dele**

- `middleware.ts`, `utils/supabase/proxy.ts`, `utils/supabase/server.ts`, `utils/supabase/client.ts`, `utils/supabase/publicEnv.ts`
- `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/route.ts`
- `app/api/auth/post-login/route.ts`, `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`
- `lib/config/env.ts`, `lib/config/env-public.ts`
- `instrumentation.ts`, `lib/supabase/init.ts`, `lib/supabase/ensureRpc.ts`

**Nyttige outputs**

- Nettverkslogg for login (cookies som settes: navn, `HttpOnly`, `Secure`, `SameSite`).  
- JWT-levetid og refresh-adferd i produksjon.  
- Supabase Dashboard: Auth-innstillinger og URL allowlist.

**Kommandoer å kjøre lokalt senere**

- `npm run typecheck`, `npm run lint`, `npm run build:enterprise` (enterprise-gate for dette repoet).  
- `npx supabase start` + `npm run db:types` (hvis lokal sannhet skal verifiseres).  
- E2E mot staging: beskyttede ruter + utløpt sesjon.

**Ikke verifisert uten runtime / remote**

- Faktisk cookie-sett i alle nettlesere og edge cases for `getClaims()`.  
- RLS-dekning vs service-role bruk i alle API-ruter.  
- Om `.env.example` i repo stemmer med produksjonskonvensjon (filen ble ikke lest her).

---

## 13. Kort konklusjon

- **På riktig vei?** **Ja.** Arkitekturen følger moderne Supabase SSR for Next.js App Router, med tydelig skille mellom public og service-role på modulnivå.
- **SSR-oppsett i hovedsak riktig?** **Ja**, med forbehold om **dual auth path** (custom cookies + SSR + Bearer) som bør forstås og evt. forenkles.
- **Trygt nok strukturert?** **Ja for secrets** (service role ikke funnet i klientbundle i denne revisjonen), men **operasjonell og konfigurasjonsrisiko** knyttet til **flere env-navn** og **middleware som kun sjekker cookie-eksistens**.
- **Tre viktigste neste steg:** (1) harmoniser publishable/anon env-kontrakt, (2) dokumenter og test auth-edge cases, (3) konsolider service-role-klient og gjennomgå admin-kall mot RLS/tenant.

---

*Rapport slutt.*
