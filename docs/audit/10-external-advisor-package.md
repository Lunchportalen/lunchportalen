# Ekstern rådgiver — lesepakke (`docs/audit/10-external-advisor-package.md`)

Dette dokumentet er ment for en ekstern teknisk rådgiver som skal fortsette der revisjonen stopper (uten tilgang til interne hemmeligheter i rapporttekst).

## Filer å lese først (prioritert)

1. `docs/audit/00-index.md` — tall, pekere, hovedfunn.
2. `docs/audit/04-full-audit-report.md` — beslutningsklar struktur (§1–19).
3. `docs/audit/07-runtime-build-auth-db-analysis.md` — auth, middleware, Supabase, env-navn.
4. `middleware.ts` — beskyttede paths, bypass paths, `updateSession`, dev bypass.
5. `utils/supabase/proxy.ts` — SSR refresh; `getClaims()`.
6. `utils/supabase/ssrSessionCookies.ts` — kanonisk cookie-navn-signal.
7. `lib/auth/getAuthContext.ts` — server-sannhet, roller, bearer, cache.
8. `lib/auth/localDevBypassCookie.ts` + `lib/auth/devBypass.ts` — dev bypass-kontrakt.
9. `app/api/auth/post-login/route.ts` — landing og `next`-allowlist.
10. `app/api/auth/login/route.ts` + `app/api/auth/logout/route.ts` + `app/api/auth/session/route.ts`.
11. `lib/config/env.ts` + `lib/config/env-public.ts` — offentlig vs server-only env-grenser.
12. `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/init.ts`.
13. `instrumentation.ts` — Node runtime hooks.
14. `next.config.ts` + `lib/runtime/nextOutput.ts` (distDir-forklaring).
15. `supabase/migrations/` — siste migrasjoner for RLS/service role (filer med `rls`/`service` i navn som startpunkt).

## Viktigste rapportfiler

| Fil | Hvorfor |
|-----|---------|
| `02-file-manifest.json` | Komplett path-inventar og klassifisering. |
| `03-file-manifest.csv` | Filtrer på `authRelated`, `dbRelated`, `classification`. |
| `08-risk-register.md` | Katalog over åpne risikoer. |
| `09-verification-results.md` | Hva som faktisk ble kjørt lokalt. |

## Kommandoer som bør kjøres videre

```bash
npm run typecheck
npm run lint
npm run build:enterprise
npm run test:run
npm run test:tenant
npm run sanity:live
```

(Ekstern rådgiver: kjør i kontrollert miljø; ingen verdier logges offentlig.)

## Manuelle smoke-tester (staging)

- Login → `POST /api/auth/login` → redirect til `GET /api/auth/post-login` → forventet rolle-landing (`/week`, `/admin`, `/superadmin`, `/kitchen`, `/driver`, `/backoffice`).
- Besøk beskyttet rute uten session → redirect til `/login` med `next` bevart.
- Logout → session cookies fjernet; tilbake til login uten loop.
- Backoffice content: åpne editor, lagre, publiseringsflyt (API under `app/api/backoffice/content/`).
- Superadmin: selskapsliste og system health (les-only der aktuelt).
- Mobil: forside `/` og `/week` (horisontal scroll, touch targets) — jf. produksjonsregler i `AGENTS.md`.

## Hva som ikke kan bekreftes uten runtime / remote

- Faktisk RLS-oppførsel mot **produksjons- eller staging-Postgres** (kun statisk gjennomgang av SQL her).
- Sanity dataset-produksjon og `sanity:live` mot ekte prosjekt.
- E-postleveranser (Resend/SMTP) og webhooks (Slack, ads, CRM).
- Ytelse under last, CDN, Vercel-region-feil.
- Full Playwright-dekning på tvers av roller og datasett.

## Merknad om hemmeligheter

- Be om **navneliste** på env fra `.env.example`, Vercel-prosjekt og Supabase-dashboard — ikke be om liming av verdier i chat.
- `SERVICE_ROLE`-nøkkel og `SYSTEM_MOTOR_SECRET` skal aldri eksponeres i klientbundles; verifiser via build-output og kodegrep (`NEXT_PUBLIC_`-prefiks).
