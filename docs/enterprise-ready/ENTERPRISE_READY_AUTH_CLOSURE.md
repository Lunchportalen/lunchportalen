# E0 — Auth closure (arbeidsstrøm 1)

**Dato:** 2026-03-29

## Metode

Stikkprøve + eksisterende tester — **ikke** full enumerering av alle `app/api/**` (561+ handlers).

## Fail-closed mønster (bekreftet i kodebase)

- `scopeOr401` / `requireRoleOr403` / `requireCompanyScopeOr403` på beskyttede API-er.
- Cron: `requireCronAuth` der brukt.
- `middleware.ts`: cookie for beskyttede **sider** — **ingen rolle** (`OPEN_PLATFORM_RISKS` A1).

## Stikkprøver (jf. `LIVE_READY_AUTH_HARDENING.md`)

| Område | Eksempel | Status |
|--------|----------|--------|
| Social | `POST /api/social/posts/publish` | superadmin + scope |
| ESG backoffice | `GET /api/backoffice/esg/summary` | superadmin |
| ESG admin | `GET /api/admin/esg/summary` | company_admin + scope |
| Dev | `POST /api/dev/test-order-status` | 404 i Vercel prod |

## «Trusted by convention»

- Hele API-flaten: konsistens antas **ikke** bevist uten mekanisk audit — **PARTIAL** evidence.

## Lukking i E0

- **Ingen** nye ruteendringer (E0-regel: ikke stor auth-refaktor).

## Konsekvens for ubetinget GO

- A1 + stor APIflate + PARTIAL evidence → **blokkerer** ubetinget enterprise-live (`UNCONDITIONAL_ENTERPRISE_LIVE_DECISION.md`).
