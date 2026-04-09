# H2 — Verification

**Dato:** 2026-03-29  
**Miljø:** Lokal utviklingsmaskin (Windows), repo `lunchportalen`.

## Kommandoer

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | **PASS** (exit 0) — 2026-03-29 |
| `npm run build:enterprise` | **PASS** (exit 0) — inkl. agents, platform guards, audit scripts, Next build, SEO-proof / SEO-audit / SEO-content-lint |
| `npm run test:run` | **PASS** (exit 0) — **212** testfiler, **1191** tester |

Full suite — ikke kun delmengde; alle grupper over er dekket innen `test:run`.

## Pilot-relevante tester (grupper)

Anbefalt utvalg (kjøres som del av full `test:run`):

| Område | Filer (eksempler) |
|--------|-------------------|
| Auth / scope | `tests/auth/*.test.ts`, `tests/api/routeGuardConsistency.test.ts` |
| Content / CMS | `tests/api/contentPages.test.ts`, `tests/cms/*.test.ts` |
| Social | stikkprøve: `tests/api/*social*` hvis finnes |
| ESG | `tests/api/backofficeEsgSummaryRoute.test.ts`, `tests/esg/*.test.ts` |
| Admin / superadmin | `tests/tenant-isolation-admin-agreement.test.ts`, `tests/api/superadmin-system-status.test.ts` |
| Cron / outbox | `tests/api/cronOutboxObservability.test.ts`, `tests/lib/observability-sli.test.ts` |

## Regression knyttet til H2-endringer

- `computeSliCronOutbox` — `tests/lib/observability-sli.test.ts`  
- Observability route — indirekte via build + typecheck  
- Dev route — ingen dedikert test (kan legges senere)  

## Feil

Ingen — alle kommandoer over returnerte exit code 0.
