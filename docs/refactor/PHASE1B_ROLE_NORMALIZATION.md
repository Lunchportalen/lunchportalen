# Phase 1B — Kanonisk rolle-normalisering

## En sannhetskilde

**`lib/auth/role.ts`**

- `normalizeRole(v: unknown): Role | null` — alle kjente aliaser (`companyadmin`, `admin`, `ansatt`, `kjokken`, `sjafor`, `super_admin`, `root`, …).
- `normalizeRoleDefaultEmployee(v: unknown): Role` — bruker `normalizeRole` + fallback `employee` (metadata/legacy).

## Konsumenter oppdatert (samme semantikk, færre duplikater)

- `lib/auth/scope.ts` — `computeRoleNoDb` + profilrolle via `normalizeRole(profile.role) ?? …`
- `lib/auth/getScopeServer.ts` — profil + metadata
- `lib/auth/routeByUser.ts` — `destinationForUser` metadata
- `lib/auth/roles.ts` — `roleFromProfile` → `normalizeRole`; `computeRole` → `normalizeRoleDefaultEmployee` for metadata
- `lib/agreement/loadAgreementContext.ts` — `toAgreementContextRole` basert på `normalizeRole`
- `app/kitchen/page.tsx`, `app/driver/page.tsx`, `app/(app)/week/page.tsx` — `normalizeRoleDefaultEmployee` der det er naturlig
- `app/api/kitchen/day/route.ts`, `app/api/cron/daily-sanity/route.ts` — samme

## `company_admin`, `superadmin`, `kitchen`, `driver`

Ingen endring av landing paths (`lib/auth/redirect.ts` `homeForRole` / `homeForUser`) i denne endringen — kun felles normalisering av strenger fra DB/metadata.

## Alias-referanse (kort)

| Input | Kanonisk |
|-------|----------|
| `kjokken` | `kitchen` |
| `sjafor` | `driver` |
| `ansatt` | `employee` |
| `admin`, `companyadmin` | `company_admin` |
| `root`, `super_admin` | `superadmin` |
