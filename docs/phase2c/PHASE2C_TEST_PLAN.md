# Phase 2C0 — Test plan (fremtidige krav per tower)

**2C0 leverer ingen nye tester.** Dette dokumentet lister **hva som bør finnes** når implementering starter.

## Company admin

| Testtype | Beskrivelse | Eksisterende referanse |
|----------|-------------|------------------------|
| Tenant isolation | Company A ser aldri B | `tests/tenant-isolation*.test.ts`, `tenant-isolation-admin-people.test.ts` |
| Rolle | Kun `company_admin` på `/api/admin/*` | `tests/auth/adminOrdersRoleGuard.test.ts`, `tests/security/roleIsolationEndpoints.test.ts` |
| Avtale | Kun eget selskap | `tests/tenant-isolation-agreement.test.ts` |

**Nye (2C+):** integrasjon «dashboard KPI» = samme tall som underliggende API (snapshot eller contract test).

## Superadmin

| Testtype | Beskrivelse | Eksisterende referanse |
|----------|-------------|------------------------|
| Avtale-livsløp | approve/reject/activate | `tests/api/superadmin.agreements-lifecycle.test.ts` |
| System status | Health-svar | `tests/api/superadmin-system-status.test.ts` |

**Nye (2C+):** regression på **frosne** firma-ruter ved enhver endring (P16).

## Kitchen

| Testtype | Beskrivelse | Eksisterende referanse |
|----------|-------------|------------------------|
| API atferd | Liste per dato, helg | `tests/kitchen/api-kitchen-route.behavior.test.ts` |
| Batch / scope | Tenant/rolle | `tests/tenant-isolation-kitchen-batch-status.test.ts`, `tests/security/kitchenDriverScopeApi.test.ts` |
| Gruppering | Determinisme | `tests/lib/kitchen/grouping.behavior.test.ts` |

## Driver

| Testtype | Beskrivelse | Eksisterende referanse |
|----------|-------------|------------------------|
| Isolasjon | Driver-scope | `tests/tenant-isolation-driver.test.ts`, `tests/rls/kitchenDriverScopePolicy.test.ts` |
| Flyt | Kvalitet | `tests/driver-flow-quality.test.ts` |

**Nye (2C+):** `confirm` idempotens og avvisning ved feil dato (allerede delvis i `route.ts`-logikk — trenger testdekning).

## Kryss-cutting

- `tests/security/privilegeBoundaries.test.ts` — ved nye endepunkter.  
- `tests/api/routeGuardConsistency.test.ts` — kontraktsjekk.
