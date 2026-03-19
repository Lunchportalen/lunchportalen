# Security verification (Phase 11)

**Protected means protected. Privilege boundaries are tested. No security-by-assumption.**

## 1. Route protection

- **API auth pattern:** Protected routes use `scopeOr401(req)` then `requireRoleOr403(ctx, action?, allowedRoles)`. Unauthenticated → 401; wrong role → 403.
- **Middleware:** Does not gate `/api/*` (by design). Auth is enforced per-route. See AGENTS.md E5.
- **Cron / internal:** Routes under `/api/cron/*` and `/api/internal/scheduler/run` use `requireCronAuth(req)`. Missing or invalid `CRON_SECRET` → 500 or 403; no job runs without valid secret.
- **Intentionally public:** `/api/health`, `/api/auth/*` (login, logout, post-login, redirect, forgot-password), `/api/public/*` (e.g. register, analytics), `/api/address/search` (proxy to Geonorge). No tenant data exposed.

## 2. Backoffice and superadmin

- **Backoffice:** All backoffice API routes use `scopeOr401` + `requireRoleOr403`. Content pages, media, releases, forms, AI (suggest, apply, jobs, image-generator, etc.) require superadmin or (where documented) company_admin. No backoffice/editor surface is reachable without auth and correct role.
- **Superadmin:** All superadmin API routes require role `superadmin` (e.g. `requireRoleOr403(ctx, ["superadmin"])`). Gate at `/api/superadmin/_gate` is used for client-side redirect; server truth is scopeOr401 + requireRoleOr403 in each route.
- **Tests:** `tests/api/contentPages.test.ts` — 401 when not authenticated; `tests/security/privilegeBoundaries.test.ts` — 403 when authenticated as company_admin for backoffice content pages GET.

## 3. Tenant isolation

- **Source of truth:** Server-side `profiles.company_id` (and `location_id` where relevant). Never trust client-sent `company_id` for scoping; admin routes use `ctx.scope.companyId` for company_admin.
- **Superadmin:** May pass `company_id` in query for filtering (e.g. admin orders); company_admin path ignores query and uses only scope.
- **Static check:** `tests/tenant-isolation-api-gate.test.ts` — listed routes must use scopeOr401 or getScope and must not read tenant identifiers from body/query for scope decisions.
- **Kitchen/driver:** `requireRoleOr403` enforces `SCOPE_NOT_ASSIGNED` when role is kitchen or driver and companyId/locationId is missing. See `tests/security/kitchenDriverScopeGuard.test.ts`.

## 4. Privileged actions and media / AI

- **Media (backoffice):** `/api/backoffice/media/items/[id]` — GET/PATCH require superadmin. No tenant-scoped media by design (backoffice is superadmin-only for media).
- **AI (backoffice):** Suggest, apply, jobs, image-generator, etc. — superadmin only, except image-generator which allows company_admin. All require scopeOr401 + requireRoleOr403.
- **Editor AI metrics:** `/api/editor-ai/metrics` — requires superadmin or company_admin.
- **Internal scheduler:** `/api/internal/scheduler/run` — executes content releases and workflow. **Hardened:** Now requires `requireCronAuth(request)`; 403 when secret missing or wrong, 500 when CRON_SECRET env not set. See `tests/security/privilegeBoundaries.test.ts`.

## 5. Environment and secrets

- **CRON_SECRET:** Used by cron and internal scheduler; never logged or exposed. Validated via `Authorization: Bearer <secret>` or `x-cron-secret`.
- **SYSTEM_MOTOR_SECRET:** Used by system-motor cron; separate env and missingCode for clarity.
- **No secrets in client:** All secret checks are server-side (route handlers or cronAuth).

## 6. Fix applied in Phase 11

- **`app/api/internal/scheduler/run/route.ts`:** Previously had no auth; any caller could POST and trigger release execution. Now uses `requireCronAuth(request)` with the same contract as `/api/cron/outbox` (500 for missing env, 403 for invalid/missing header). Scheduler must be invoked with valid CRON_SECRET (e.g. from Vercel cron or similar).

## 7. Tests covering privilege boundaries

| Test file | What it verifies |
|-----------|------------------|
| `tests/api/contentPages.test.ts` | Backoffice content pages: 401 when not authenticated; 200 when authenticated as superadmin; 409 on slug conflict when applicable. |
| `tests/security/kitchenDriverScopeGuard.test.ts` | Kitchen/driver: 403 SCOPE_NOT_ASSIGNED when companyId or locationId missing; 403 FORBIDDEN when role not allowed. |
| `tests/security/privilegeBoundaries.test.ts` | Backoffice content pages GET returns 403 when authenticated as company_admin; internal scheduler POST returns 403 without cron secret, 500 when CRON_SECRET not set. |
| `tests/api/cronOutboxAuth.test.ts` | Cron outbox: 500 when CRON_SECRET missing, 403 when header missing or wrong, 200 with result when auth valid. |
| `tests/tenant-isolation-api-gate.test.ts` | Listed routes use scopeOr401 or getScope; no tenant from client body/query for scope. |

---

**Success criteria met:** Protected means protected; privilege boundaries are tested; internal scheduler no longer relies on security-by-assumption.
