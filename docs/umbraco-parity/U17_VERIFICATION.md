# U17 — Verification

**Dato:** 2026-03-29  
**Endringstype:** U17 DEEP — dokumentasjon + kode (`BackofficeExtensionContextStrip`, `findBackofficeExtensionForPathname`).

## Kommandoer

| Kommando | Resultat | Notat |
|----------|----------|-------|
| `npm run typecheck` | **PASS** (exit 0) | `tsc --noEmit` |
| `npm run build:enterprise` | **PASS** (exit 0) | RC_MODE + platform guards + `next build` + SEO scripts (SEO-PROOF / AUDIT / CONTENT-LINT OK) |
| `npm run test:run` | **PASS** (exit 0) | Vitest: **221** filer, **1226** tester |

**Siste kjøring:** U17 DEEP build-økt (2026-03-29).

## Fokuserte testgrupper (anbefalt for regresjon)

| Gruppe | Tester / område |
|--------|-------------------|
| Auth | `tests/**` auth/session, tenant |
| Content | `tests/cms/**`, content API |
| Week | uke-/meny-relaterte (der definert) |
| Social | `test:social-flow`, `lib/social` |
| SEO | `scripts/seo-*.mjs` (i build:enterprise) |
| ESG | API routes under `app/api/**/esg` |
| Admin | `app/admin` guards |
| Superadmin | frosne lister — ikke client auth |
| Kitchen / Driver | smoke der finnes |
| CMS/backoffice parity | `tests/cms/backofficeExtensionRegistry.test.ts`, `tests/cms/backofficeCommandPalette.test.ts` |

## Lint

Full gate: følg `AGENTS.md` (`lint` ved kodeendring).
