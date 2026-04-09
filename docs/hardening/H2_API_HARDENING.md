# H2 — Pilot API hardening

**Dato:** 2026-03-29  
**Kilde:** `OPEN_PLATFORM_RISKS.md` (A1–A3), `API_SURFACE_AND_GATING_REPORT.md`, stikkprøver på muterende ruter.

## Pilot-scope (fail-closed prinsipp)

| Lag | Krav |
|-----|------|
| **Sider** | Middleware krever `sb-access-token` på beskyttede paths — **ingen rolle**. |
| **API** | Hver rute **må** bruke `scopeOr401` + `requireRoleOr403` / `requireCompanyScopeOr403` der aktuelt. |
| **Cron** | `requireCronAuth` + `CRON_SECRET` (eller spesial: `SYSTEM_MOTOR_SECRET` der dokumentert). |

## Stikkprøve — sensitive flater (status etter H2)

| Flate | Eksempel | Status |
|-------|----------|--------|
| **Social mutasjon** | `POST /api/social/posts/save`, `POST /api/social/posts/publish` | **superadmin** + `scopeOr401`; publish er **dry-run** mot Meta inntil nøkler finnes. |
| **ESG backoffice** | `GET /api/backoffice/esg/summary`, `GET /api/backoffice/esg/latest-monthly` | **superadmin** (samme som UI-kontrakt i tester). |
| **ESG company admin** | `GET /api/admin/esg/summary` | **company_admin** + `requireCompanyScopeOr403`. |
| **SEO AI** | `POST /api/backoffice/ai/seo-intelligence` | **superadmin** (stikkprøve). |
| **Dev order test** | `POST /api/dev/test-order-status` | **H2:** returnerer **404** når `VERCEL_ENV=production` — **fail-closed** mot utilsiktet ordremutasjon i prod. |

## Åpne risikoer (ikke «lukket» av H2)

| ID | Risiko | Kommentar |
|----|--------|-----------|
| A1 | Middleware uten rolle | Uendret — layout/API må fortsatt enforce. |
| A2 | Stor APIflate | Ingen full maskinell audit av alle ~561 ruter; **prosess:** pilot-liste. |
| A3 | `strict: false` | Utenfor H2-scope. |

## Kodeendringer (H2)

- `app/api/dev/test-order-status/route.ts` — produksjonsblokkering (se `PHASE_H2_CHANGED_FILES.md`).

## Anbefaling etter pilot

- Utvid `lib/system/routeRegistry.ts` eller generert liste fra `scripts/audit-api-routes.mjs` med **eksplisitt pilot-allowlist** for API-prefixer.
