# Runtime, build, auth, database — dybdeanalyse (`docs/audit/07-runtime-build-auth-db-analysis.md`)

## 1. Runtime (Node / Edge)

- **Node server:** `instrumentation.ts` kjører `register()` når `NEXT_RUNTIME === "nodejs"`. Den importerer dynamisk `lib/supabase/init.ts` (`initSupabaseServerHooks`) og registrerer shutdown-hooks via `lib/infra/shutdown.ts` (SIGTERM/SIGINT). Feil i disse blokkene svelges (non-fatal) — bevisst for å unngå oppstartsfeil.
- **Edge (middleware):** `middleware.ts` kjører på Edge-runtime. Den importerer `updateSession` fra `utils/supabase/proxy.ts` og dev-bypass-hjelpere fra `lib/auth/localDevBypassCookie.ts` (som bruker `atob` — edge-kompatibel).
- **Next.js output directory:** `next.config.ts` bruker `resolveNextDistDir(phase)` fra `lib/runtime/nextOutput.ts` — mulig separasjon av build-output (relevant for parallelle builds / verktøy).

## 2. Build

- **Scripts:** `package.json` — `build` kjører `verify-control-coverage.mjs` deretter `next build`. `build:enterprise` kjører RC_MODE, agents check, platform guards, API audit, repo audit, flere copy/provider checks, `next build` med RC_MODE, deretter SEO-scripts.
- **Verifisert lokalt:** `npm run build` **PASS** (se `09-verification-results.md`). `build:enterprise` **ikke** kjørt i denne revisjonen.

## 3. Auth — kanonisk sannhet

- **Session signal (normal drift):** Supabase SSR cookies med navnemønster `sb-*-auth-token*` (se `utils/supabase/ssrSessionCookies.ts`). Dette er eksplisitt dokumentert i `lib/auth/getAuthContext.ts` og `lib/auth/localDevBypassCookie.ts`.
- **Middleware:** Etter `updateSession`, settes `hasSupabaseSessionCookie` fra cookie-jar på request/response. For beskyttede paths kreves `hasSupabaseSessionCookie || localDevBypass` (justerbar liste i `middleware.ts`).
- **Server (RSC / route handlers):** `getAuthContext()` i `lib/auth/getAuthContext.ts` ( `server-only` ) bygger identitet via `createServerClient` / `createClient` med cookies eller `Authorization: Bearer` (ingen “cookie-stored access token fallback” annet enn SSR-jar).
- **Rolle og scope:** Profil/oppslag via `lookupMembership`, normalisering med `normalizeRole`, superadmin allowlist via `lib/system/emails.ts` (koblet til `SYSTEM_EMAIL_ALLOWLIST` — navn kun her).
- **Post-login:** `app/api/auth/post-login/route.ts` — kanonisk resolver for landing etter login; må samsvare med `AGENTS.md` E5 (allowlist for `next`).

## 4. Middleware og importkjede

**Kjede (rot → blad):**

1. `middleware.ts` → `isLocalDevAuthenticatedRequest` ← `lib/auth/localDevBypassCookie.ts`
2. `middleware.ts` → `updateSession` ← `utils/supabase/proxy.ts`
3. `utils/supabase/proxy.ts` → `@supabase/ssr` `createServerClient`
4. `utils/supabase/proxy.ts` → `utils/supabase/publicEnv.ts` (via `getSupabasePublicCredentials`)
5. `utils/supabase/proxy.ts` → `hasSupabaseSsrAuthCookieInJar` ← `utils/supabase/ssrSessionCookies.ts`

**Edge-sikkerhet:**

- Ingen `fs`, ingen Node-only moduler observert i denne kjeden.
- `lib/system/emails.ts` er **ikke** importert i middleware (testen `middlewareImportEdgeSafe.test.ts` bekrefter at top-level throw i emails ikke krasjer middleware-import).

**Tidligere problemer / nåværende status:**

- **Håndtert (ifølge tester og kode):** Edge-sikker import av middleware; eksplisitt skille mellom refresh-lag (`proxy.ts`) og full auth (`getAuthContext` på server).

## 5. Supabase-arkitektur (filer som bør anses som kanoniske)

| Formål | Fil(er) |
|--------|---------|
| Public URL + publishable key (server helpers) | `lib/config/env.ts`, `lib/config/env-public.ts` |
| Browser / SSR server client oppsett | `lib/supabase/server.ts`, `@supabase/ssr` i `utils/supabase/proxy.ts` |
| Service role (admin) | `lib/supabase/admin.ts` — **kun server** |
| Init hooks | `lib/supabase/init.ts`, `lib/supabase/ensureRpc.ts` |
| Typer | `lib/types/database.ts` (generert ved behov) |
| Public env for edge | `utils/supabase/publicEnv.ts` |

**Duplikatrisiko:** Flere entry points for “public key” (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` med fallbacks til `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`) — bevisst dokumentert i `env.ts`.

## 6. Database og migrasjoner

- **Migrasjoner:** `supabase/migrations/*.sql` — **153** filer (manifest-stemmer med glob).
- **Øvrig SQL (ikke generert):** inkluderer `scripts/sql/seed_home_cms.sql`, `docs/db/*.sql`, og lokale `.tmp*` kopier — **disse er ikke “kanonisk migrasjon”**; vurder cleanup av `.tmp*` utenfor VCS.
- **Remote DB:** Ikke kontaktet i revisjonen.

## 7. Miljøvariabler (kun navn — ikke verdier)

Nedenfor er **utvalgte** grupper. Full liste krever statisk analyse av hele monorepo; de fleste navn finnes via søk etter `process.env.` i `lib/` og `app/`.

### Supabase / offentlig

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (primær)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (legacy fallback)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy fallback)
- `SUPABASE_URL` (server, brukt i admin-klient)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)

### Sanity

- `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `NEXT_PUBLIC_SANITY_API_VERSION`
- `SANITY_WRITE_TOKEN`
- `NEXT_PUBLIC_SANITY_STUDIO_URL`, `SANITY_STUDIO_URL`

### Auth / drift / CMS runtime

- `NODE_ENV`, `VITEST`, `RC_MODE`
- `LP_DEBUG_AUTH`, `LP_CMS_RUNTIME_MODE`, `LP_REMOTE_BACKEND_AUTH_HARNESS`
- `LOCAL_DEV_AUTH_BYPASS` (se `localDevBypassCookie.ts`)
- `SYSTEM_EMAIL_ALLOWLIST`

### System motor / cron

- `SYSTEM_MOTOR_SECRET`, `CRON_SECRET`, mange `*_ENABLED` flagg for cron-motorer under `app/api/cron/`

### URL-er (offentlige / server)

- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_APP_URL`, `PUBLIC_APP_URL`, `NEXT_PUBLIC_VERCEL_URL`, `VERCEL_URL`, `BOOKING_URL`

### E-post

- `RESEND_API_KEY`, `RESEND_FROM`, `SMTP_*`, `LP_SMTP_*`, `ORDER_SMTP_*`, `CONTACT_TO`, `CONTACT_FROM`, m.fl.

### AI / integrasjoner

- `OPENAI_API_KEY`, `AI_API_KEY`, `AI_PROVIDER`, `AI_MODEL`, `CMS_AI_DEFAULT_COMPANY_ID`, `HUBSPOT_API_KEY`, `REDIS_URL`, `STRIPE_*` (hvis i bruk), osv.

### `.env.example` (subset observert via navneekstraksjon)

`ADS_ENABLED`, `AI_OBSERVABILITY_PERSIST`, `ALERT_EMAIL_ENABLED`, `EMAIL_ENABLED`, `MONITORING_ENABLED`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `PROFIT_ENGINE_ENABLED`, `SCALING_ENGINE_ENABLED`, `SLACK_WEBHOOK_URL`, `SYSTEM_MOTOR_SECRET`, `TRIPLETEX_*` (flere), osv.

**Merk:** `.env.example` ser ikke ut til å liste hele mengden faktisk brukt i kode — **ikke** bruk den alene som sannhetskilde for alle påkrevde variabler.

## 8. Local dev bypass

- **Implementasjon:** `isLocalDevAuthBypassEnabled()` i `lib/auth/localDevBypassCookie.ts`:
  - Returnerer **alltid false** når `NODE_ENV === "production"`.
  - Ellers true hvis `isLocalCmsRuntimeEnabled()` (`lib/localRuntime/runtime.ts`) eller `LOCAL_DEV_AUTH_BYPASS=true`.
- **Cookie:** `lp_local_dev_auth` — payload valideres til fast `superadmin`-session i decode (ikke generell rolle-imitasjon).
- **Server parity:** `lib/auth/devBypass.ts` skriver/koordinerer cookies; kommentarer sier eksplisitt at `sb-access-token` speil **ikke** er kanonisk bevis sammenlignet med SSR-jar / `lp_local_dev_auth`.
- **Middleware alignment:** `middleware.ts` kommentar krever samsvar med `getAuthContext()` — begge bruker samme bypass-gate.

**Konklusjon:** Bypass er **eksplisitt** dokumentert og **avskrudd i produksjon** via `NODE_ENV`. Risiko for utilsiktet aktivering i prod anses som **lav** så lenge deployment faktisk setter `NODE_ENV=production`.

## 9. Importkjeder — server-only lekasje

- `getAuthContext.ts` starter med `import "server-only"` — riktig mønster.
- Middleware må **ikke** importere `lib/supabase/admin.ts` eller `nodemailer` — ikke observert i gjennomgått kjede.

## 10. Staging / merge-beredskap

- Standard `build` og `typecheck` er grønne lokalt; **enterprise**-pipen er strengere.
- Gren med mange parallelle endringer øker behov for full test+e2e før staging — se `08-risk-register.md` R5.
