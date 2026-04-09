# LIVE READY — Verifikasjon (arbeidsstrøm 6)

**Dato:** 2026-03-29  
**Miljø:** Lokal utviklingsmaskin (Windows), repo `lunchportalen`.

## Obligatorisk gate-sekvens

| Kommando | Exit | Merknad |
|----------|------|---------|
| `npm run typecheck` | **0** | `tsc --noEmit` OK |
| `npm run build:enterprise` | **0** | Inkl. `agents:check`, plattform-guards, API/repo-audit, `next build`, `seo-proof.mjs`, `seo-audit.mjs`, `seo-content-lint.mjs` — avsluttet med **SEO-PROOF OK**, **SEO-AUDIT OK**, **SEO-CONTENT-LINT OK** |
| `npm run test:run` | **0** | Vitest: **212** testfiler, **1191** tester, varighet ~38 s (én full kjøring i denne verifikasjonen) |

## Fokuserte testgrupper (ikke obligatorisk for denne leveransen)

Eksisterende scripts i `package.json` (kjør ved behov / CI-dybde):

- `npm run test:tenant` — `tests/tenant-isolation.test.ts`
- `npm run test:rls` — `tests/rls/tenantIsolation.final.test.ts`
- `npm run test:db` — `tests/db/database-integrity.test.ts`

Vitest-samlingen dekver allerede bl.a. auth (`tests/auth/**`), backoffice/CMS (`tests/cms/**`, `tests/backoffice/**`), kitchen/driver (`tests/kitchen/**`, `tests/driver/**`), superadmin API (`tests/api/superadmin-system-status.test.ts`, `tests/superadmin/**`), ESG (`tests/esg/**`, `tests/api/backofficeEsgSummaryRoute.test.ts`), cron/outbox (`tests/api/cronOutbox*.test.ts`), sikkerhet (`tests/security/**`).

## Feil

- Ingen av de tre obligatoriske kommandoene feilet i verifikasjonen beskrevet over.

## Konsekvens for GO/NO-GO

- **Bygg + typer + tester** er grønt — se `BROAD_LIVE_GO_DECISION.md` for forretnings- og driftsvilkår utover CI.
