# API surface and gating report (V2)

**Omfang:** `app/api/**`, `lib/http/routeGuard.ts`, `lib/security/*`, `middleware.ts`, `lib/system/routeRegistry.ts` (stikkprøver).

## Overflate-størrelse

- **~561** `route.ts` filer under `app/api` (glob-skanning ved audit — avrunding OK).
- **Klassifisering:** **SCALE_RISK** + **SECURITY_RISK** (stor angrepsflate uten full inventory).

## Middleware boundary (`middleware.ts`)

| Atferd | Observasjon | Klassifisering |
|--------|-------------|----------------|
| Beskyttede stier | `/week`, `/admin`, `/superadmin`, `/backoffice`, `/orders`, `/driver`, `/kitchen`, `/saas` | **ACTIVE** |
| Auth-sjekk | Cookie `sb-access-token` **eksisterer** — **ikke** rolle | **SECURITY_RISK** / **NEEDS_REVERIFICATION** |
| API bypass | `/api/*` **unntatt** login/post-login/logout — **mesteparten** av API utenfor middleware auth | **SECURITY_RISK** — API må **selv** enforce (`scopeOr401`) |
| Login loop | `/login` bypass — i tråd med policy | **CANONICAL** |

**Bevis:** `middleware.ts` linjer 4–21 (bypass), 24–34 (protected), 86–99 (redirect login).

## Route guards (API)

| Primitiv | Fil | Rolle |
|----------|-----|-------|
| `scopeOr401` | `lib/http/routeGuard.ts` | Henter scope, 401 ved manglende auth |
| `requireRoleOr403` | samme | Rolle-gate |
| `denyResponse` | samme | Kanonisk 401 fra `scopeOr401` |

**Grep:** `requireRoleOr403` / `scopeOr401` forekommer i **hundrevis** av API-filer — **ACTIVE** mønster.

## Admin / superadmin / backoffice gating

| Lag | Kommentar |
|-----|-----------|
| **Layout (server)** | Forventet for sider — **ikke** analysert fil-for-fil i V2. |
| **API** | Må bruke `scopeOr401` + rolle; **REVERIFY** for nye «growth»-ruter. |

## `lib/system/routeRegistry.ts`

- Delvis **enterprise proof** liste — **ikke** ekshaustiv for alle 561 ruter.
- Notater om **legacy** vs **dag3** for ordre — **CANONICAL** som dokumentasjon.

## Sensitive routes — status

| Kategori | Vurdering |
|----------|-----------|
| Ordre / upsert / toggle | **ACTIVE** guards + tester (`tests/api/order-*.test.ts`) |
| Backoffice CMS | **ACTIVE** — mange tester under `tests/api/`, `tests/backoffice/` |
| Superadmin system | `tests/api/superadmin-system-status.test.ts` pass |
| «Something» | **FAIL-CLOSED** — krever superadmin eller cron secret |

## Duplikat API-yter (kort)

- **ESG:** `admin` / `backoffice` / `superadmin` — se `DUPLICATE_AND_SHADOW_REPORT.md`.

## Konklusjon

- **API sprawl** er **STILL_OPEN_FROM_BASELINE** + **NEW_RISK** (omfang).  
- **Middleware** = **kun** cookie-gate for **sider** — **ikke** erstatning for API-sikkerhet.  
- **Anbefaling:** **REVERIFY** alle nye `app/api` ruter mot `scopeOr401` + tenant-filter.
