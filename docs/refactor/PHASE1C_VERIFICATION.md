# Phase 1C — Verifikasjon

## `npm run typecheck`

**PASS** (2026-03-28).

## Vitest (employee / route-fokus)

Kjørt:

- `tests/auth/employeeDirectRouteBehavior.test.ts`
- `tests/auth/employeeOrdersRedirect.test.ts`
- `tests/auth/employeeMinSideRedirect.test.ts`
- `tests/auth/employeeAppSurface.test.ts` (1B)
- `tests/lib/weekAvailability.test.ts` (anbefalt — torsdag/fredag-regler)

**PASS** for målrettede filer i siste kjøring.

Full `npm run test:run` er ikke obligatorisk dokumentert her; kjør før merge om du endrer tverrgående auth/CMS.

## `npm run build:enterprise`

**PASS** (lokal Windows, etter `NODE_OPTIONS` i `package.json`): `next build` fullførte, statiske sider generert, SEO-skript, **exit code 0**.
