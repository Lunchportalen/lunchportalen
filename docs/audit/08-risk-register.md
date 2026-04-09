# Risikoregister (`docs/audit/08-risk-register.md`)

Skala: **Severity** (Critical / High / Medium / Low), **Sannsynlighet** (Lav / Middels / Høy), **Påvirkning** (Lav / Middels / Høy). Status reflekterer funn ved revisjon 2026-04-05 — ikke produktendringer.

| ID | Severity | Sannsynlighet | Påvirkning | Område / fil(er) | Beskrivelse | Anbefalt tiltak | Status |
|----|----------|---------------|------------|------------------|-------------|-----------------|--------|
| R1 | Medium | Middels | Middels | `app/api/debug/whoami/route.ts`, `app/api/auth/login-debug/route.ts` | Debug-/diagnose-API-er kan eksistere i produksjon hvis ikke begrenset av deployment/guards. | Verifiser at disse er blokkert i prod (middleware, env-gate, eller fjern routes); overvåk tilgang i WAF/logs. | åpen |
| R2 | Low | Høy | Lav | Diverse `app/**/*.tsx` (se `09-verification-results.md`) | Mange ESLint-advarsler (hooks deps, `no-img-element`) — vedlikeholdsrisiko, ikke direkte sikkerhet. | Planlagt opprydding i backoffice/superadmin-UI; vurder `next/image` der LCP er kritisk. | åpen |
| R3 | Medium | Lav | Høy | `lib/supabase/admin.ts`, API-ruter som kaller service role | Feil bruk av service role kan omgå RLS. | Kodegjennomgang per rute: kun server-side, alltid med `company_id`/`superadmin`-gate; penetrasjonstest mot representative API-er. | delvis håndtert (arkitektur forventer server-only); **ikke verifisert** mot live DB |
| R4 | Low | Middels | Middels | Rot: `.tmp_public_schema.sql`, `.tmp_remote_types.ts`, `.tmp/`, logger (`*_proof*.log`) | Temp- og loggfiler i repo kan skape støy eller utilsiktet deling hvis committet. | Sikre `.gitignore`; ikke commit `.env.local`; rydd tmp-filer i release-grener. | åpen |
| R5 | Medium | Middels | Middels | Gren `rescue-ai-restore` (observasjon fra git status ved revisjonsstart) | Mange samtidige endringer øker regressjonsrisiko ved merge. | Kjør `build:enterprise`, full `test:run`, e2e på staging; feature-flag eller del-merge. | åpen |
| R6 | Low | Lav | Middels | `app/api/something/route.ts`, `app/api/example/route.ts` (eksisterer i tre) | Eksempel-/støtte-ruter kan forvirre angrepsflate hvis eksponert uten auth. | Bekreft auth eller fjern i prod; dokumenter hensikt. | ikke verifisert (krever lesing av hver route) |
| R7 | High | Lav | Høy | Miljø: `SUPABASE_SERVICE_ROLE_KEY`, `SYSTEM_MOTOR_SECRET`, SMTP-passord, API-nøkler | Lekkasje til klient eller logger er kritisk. | Ingen `NEXT_PUBLIC_` på secrets; roterende nøkler; hemmeligheter kun i Vercel/secret store. | delvis håndtert (mønster i `lib/config/env.ts`); **kontinuerlig** operativ disiplin |
| R8 | Low | Middels | Lav | `studio/` (Sanity Studio workspace) | Egen avhengighetsflate; må holdes oppdatert som resten av monorepo. | Avhengighetsaudit separat for `studio/package.json` om tilgjengelig. | ikke verifisert (kun path-inventar) |

**Merk:** Ingen automatiske sårbarhetsskannere (Snyk, osv.) ble kjørt i denne revisjonen.
