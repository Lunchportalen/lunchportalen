# Phase 1B — Employee route audit (kun `/week` som appflate)

## Mål

Ansatt (`employee`) skal kun bruke **`/week`** som hovedfrontend under `(app)`-layout (HeaderShell). API-ruter (`/api/...`) er uendret i denne fasen.

## Bevis i kode

### Middleware

`middleware.ts` setter `x-pathname` på alle requests (unntatt bypass). `app/(app)/layout.tsx` leser `headers().get("x-pathname")`.

### Policy (path)

- `lib/auth/employeeAppSurfacePath.ts` — `isEmployeeAllowedAppSurfacePath(pathname)`: tillater kun `/week` og `/week/*`.
- `lib/auth/employeeAppSurface.ts` — `enforceEmployeeWeekOnlyOnAppShell()`: kaller `getAuthContext()`; ved `role === "employee"` og path ≠ tillatt → `redirect("/week")`.

### `app/(app)/layout.tsx`

Server layout kaller `await enforceEmployeeWeekOnlyOnAppShell()` før `HeaderShell` — gjelder **`/week`**, **`/home`**, **`/dashboard`** (alle under `(app)`).

### Andre employee-relaterte sider

| Route | Tilgjengelighet | Oppførsel |
|-------|-----------------|-----------|
| `/week` | Ja (employee) | Primærflate |
| `/home` | Krever innlogging, men employee redirectes til `/week` av layout-guard | |
| `/dashboard` | Samme som `/home` for employee | |
| `/orders` | `app/orders/page.tsx` — employee → `redirect("/week")` | |
| `/min-side` | `app/min-side/page.tsx` — aktiv bruker → `redirect(homeForRole(scope.role))` (employee → `/week`) | |

### Tester (direkte path-policy)

`tests/auth/employeeAppSurface.test.ts` importerer **kun** `employeeAppSurfacePath` (ingen `server-only`) og verifiserer tillatt/nektet path-matrise.

### Post-login (eksisterende)

`tests/auth/postLoginRedirectSafety.test.ts` — employee `next=/orders` faller tilbake til `/week` (allowlist).

## Gjenstående / oppmerksomhet

- **RSC layout** avhenger av at `x-pathname` er satt (middleware). Tom `x-pathname` → guard **ingen** redirect (fail-open for denne sjekken; uvanlig i produksjon).
- Roller som ikke er `employee` påvirkes ikke av denne guard.
