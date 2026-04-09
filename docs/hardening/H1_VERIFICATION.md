# H1 — Verifikasjon

**Dato:** 2026-03-28

## Kommandoer

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run build:enterprise` | PASS (inkl. SEO-gates) |

## Vitest (relevante stikkprøver)

Kjørt etter H1-endringer (2026-03-29):

```
npx vitest run tests/api/somethingRoute.test.ts tests/security/privilegeBoundaries.test.ts tests/api/backofficeEsgSummaryRoute.test.ts tests/superadmin/capabilities-contract.test.ts tests/cms/merge-seo-variant-body.test.ts
```

**Resultat:** 5 filer, 11 tester — **PASS**.

Full `vitest run` er **ikke** obligatorisk for H1-leveransen; kjør før pilot-merge.

## Manuelt (pilot)

- [ ] POST til `/api/something` uten cookie og uten cron-headers → **401** (eller 403 hvis feil cron).  
- [ ] POST med gyldig `Authorization: Bearer <CRON_SECRET>` når secret er satt → **200** med gyldig body.
