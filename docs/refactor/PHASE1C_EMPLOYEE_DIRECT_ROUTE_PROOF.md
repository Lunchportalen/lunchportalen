# Phase 1C — Direkte employee route-bevis

## Metode

Vitest som **laster** faktiske server-moduler og verifiserer at `next/navigation.redirect` kalles med forventet URL (mønster som `backoffice-layout-guard.test.ts`).

## Tester

| Fil | Hva som bevises |
|-----|---------------------|
| `tests/auth/employeeDirectRouteBehavior.test.ts` | `enforceEmployeeWeekOnlyOnAppShell`: employee + `/home` eller `/dashboard` → `/week`; employee + `/week` → ingen redirect; `company_admin` + `/home` → ingen redirect fra denne guard |
| `tests/auth/employeeOrdersRedirect.test.ts` | `app/orders/page` med `getScope` → employee → `redirect("/week")` |
| `tests/auth/employeeMinSideRedirect.test.ts` | `app/min-side/page` med employee `getScope` → `redirect("/week")` (eksplisitt guard i side, ikke bare `homeForRole`) |
| `tests/auth/employeeAppSurface.test.ts` (1B) | Ren path-matrise `isEmployeeAllowedAppSurfacePath` |

## Kode (kort)

- **`app/(app)/layout.tsx`**: `enforceEmployeeWeekOnlyOnAppShell()` før `HeaderShell`.
- **`app/min-side/page.tsx`**: `if (scope.role === "employee") redirect("/week")` før øvrig `homeForRole`.
- **`app/orders/page.tsx`**: employee → `redirect("/week")`.

## Konklusjon

- Employee **når ikke** `/home` eller `/dashboard` som innhold (redirect til `/week`).
- **`/orders`** og **`/min-side`** ender i **`/week`** for employee (redirect).
