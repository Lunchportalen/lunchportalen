# Phase 1C — Komponentrot, slice 2 (etter nav)

## Migrert til `src/components/` (kanonisk)

| Før (`components/`) | Etter |
|---------------------|--------|
| `components/layout/PageSection.tsx` | `src/components/layout/PageSection.tsx` + tynn re-export i `components/layout/PageSection.tsx` |
| `components/week/WeekMenuReadOnly.tsx` | `src/components/week/WeekMenuReadOnly.tsx` + re-export i `components/week/WeekMenuReadOnly.tsx` |

Tidligere (1B): `src/components/nav/*` (HeaderShellView, NavActiveClient, AuthSlot).

## `tsconfig` paths

`@/components/*` → `src/components/*` **først**, deretter `components/*`.

`@/components/layout/PageSection` og `@/components/week/WeekMenuReadOnly` løser nå til `src/` når filene finnes der.

## Imports som fortsatt peker på `components/` (fysisk)

Alt under `components/` som **ikke** er flyttet til `src/components/`, f.eks.:

- `components/auth/*`, `components/ui/*`, `components/AppFooter.tsx`, `components/layout/*` (øvrige enn PageSection), `components/superadmin/*`, osv.

Søk: `from \"@/components/` — alias prioriterer `src/` når fil finnes; re-exports i `components/` støtter eventuelle relative imports.

## Gjenstår

- Flytte `AppFooter`, `layout/EmployeeLayout`, `layout/PublicLayout`, `auth/LogoutClient` i senere faser etter samme mønster.
