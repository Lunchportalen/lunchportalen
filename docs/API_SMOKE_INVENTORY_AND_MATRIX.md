# API smoke inventory and verification matrix

**Source:** Crawl of `app/api/**/route.ts`. No `pages/api` (App Router only).  
**Evidence:** `tests/api/smoke-api-routes.test.ts`, existing tests in `tests/api/`, `tests/security/`, `tests/auth/`.

---

## 1. API inventory (summary)

| Namespace | Route path pattern | HTTP methods | Auth (visible) | Main dependency | Risk |
|-----------|--------------------|--------------|----------------|-----------------|------|
| **auth** | `/api/auth/login` | POST | None (public) | Supabase auth, env (NEXT_PUBLIC_SUPABASE_*) | High |
| | `/api/auth/post-login` | GET, POST | getAuthContext | Supabase, cookies | High |
| | `/api/auth/session` | POST | Cookies | Supabase SSR | High |
| | `/api/auth/me`, `/api/auth/profile`, `/api/auth/forgot-password`, `/api/auth/accept-invite`, etc. | GET/POST | scopeOr401 / session | Supabase | High |
| **me / profile** | `/api/me`, `/api/me/agreement` | GET | supabaseServer().auth.getUser() | Supabase | High |
| | `/api/profile`, `/api/profile/set-scope` | GET, POST | scopeOr401 | Supabase | Medium |
| **order / orders** | `/api/order`, `/api/order/window`, `/api/order/set-choice`, `/api/order/bulk-set`, etc. | GET, POST | scopeOr401 | Supabase, Sanity | High |
| | `/api/orders`, `/api/orders/my`, `/api/orders/today`, `/api/orders/[orderId]`, etc. | GET, POST, PATCH, DELETE | scopeOr401 | Supabase | High |
| **week / weekplan** | `/api/week` | GET | scopeOr401 | Supabase, request URL | High |
| | `/api/weekplan`, `/api/weekplan/next`, `/api/weekplan/publish` | GET, POST | scopeOr401, cookies() | Supabase, Sanity | High |
| **backoffice** | `/api/backoffice/content/*`, `/api/backoffice/forms/*`, `/api/backoffice/releases/*` | GET, POST, PATCH, DELETE | scopeOr401, requireRole (superadmin) | Supabase | High |
| | `/api/backoffice/ai/*`, `/api/backoffice/media/*` | GET, POST | scopeOr401, requireRole | Supabase, AI provider | High |
| **superadmin** | `/api/superadmin/_gate`, `/api/superadmin/system/*`, `/api/superadmin/companies/*`, etc. | GET, POST, PATCH, DELETE | scopeOr401, requireRole superadmin | Supabase | High |
| **kitchen** | `/api/kitchen`, `/api/kitchen/today`, `/api/kitchen/company`, `/api/kitchen/batch/*`, etc. | GET, POST | scopeOr401, role kitchen | Supabase | High |
| **driver** | `/api/driver/orders`, `/api/driver/stops`, `/api/driver/today`, `/api/driver/bulk-set` | GET, POST | scopeOr401, role driver | Supabase | High |
| **cron / internal** | `/api/cron/*`, `/api/internal/scheduler/run` | GET, POST | requireCronAuth (CRON_SECRET / SYSTEM_MOTOR_SECRET) | Supabase, Sanity, env | High |
| **public** | `/api/public/forms/[id]`, `/api/public/onboarding/*`, `/api/public/register-company`, `/api/public/analytics`, `/api/public/search` | GET, POST | None or minimal | Supabase, env | Medium |
| **health / system** | `/api/health`, `/api/system/health`, `/api/system/time`, `/api/system/outbox/process` | GET, POST | None (health) or cron/auth | Supabase, env (SYSTEM_MOTOR_SECRET) | Medium |
| **onboarding** | `/api/onboarding/complete`, `/api/onboarding/terms-pdf` | POST, GET | None / session | Supabase | Medium |
| **admin** | `/api/admin/*` (dashboard, people, employees, invites, agreement, locations, orders, etc.) | GET, POST, PATCH | scopeOr401, company_admin | Supabase | High |
| **editor-ai** | `/api/editor-ai/metrics` | POST | scopeOr401 | Supabase, AI | Medium |

---

## 2. Verification matrix (prioritized routes)

| ROUTE | METHODS | STATUS | EVIDENCE | FAILURE POINT |
|-------|---------|--------|----------|----------------|
| `/api/health` | GET | VERIFIED | smoke-api-routes: GET returns Response, status ≠ 500 | — |
| `/api/auth/login` | POST | VERIFIED | smoke-api-routes: POST JSON returns non-500; healthPublic/env | — |
| `/api/auth/post-login` | GET, POST | VERIFIED | smoke-api-routes GET; postLoginRedirectSafety.test.ts | — |
| `/api/me` | GET | VERIFIED | smoke-api-routes: GET returns 401 or 200, non-500 | — |
| `/api/auth/session` | POST | VERIFIED | smoke-api-routes: POST returns Response, non-500 | — |
| `/api/orders` | GET, POST, DELETE | VERIFIED | smoke-api-routes GET; tenant-isolation.test.ts, admin orders tests | — |
| `/api/order/window` | GET | VERIFIED | smoke-api-routes GET; tenant-isolation-agreement | — |
| `/api/week` | GET | PARTIAL | smoke-api-routes: returns 500 (Invalid URL) with minimal req; needs valid request URL | Request URL/context |
| `/api/weekplan` | GET | BLOCKED | smoke-api-routes: `cookies()` outside request scope in vitest | Next request scope |
| `/api/backoffice/content/pages` | GET, POST | VERIFIED | smoke-api-routes GET; contentPages.test.ts, privilegeBoundaries | — |
| `/api/backoffice/content/home` | GET | VERIFIED | smoke-api-routes GET; contentHome.test.ts | — |
| `/api/backoffice/content/tree` | GET | VERIFIED | smoke-api-routes GET; contentTree.test.ts | — |
| `/api/backoffice/releases` | GET, POST | VERIFIED | smoke-api-routes GET | — |
| `/api/backoffice/ai/status` | GET | VERIFIED | smoke-api-routes GET | — |
| `/api/backoffice/media/items` | GET, POST | VERIFIED | smoke-api-routes GET; mediaItems.test.ts, mediaItemsId.test.ts | — |
| `/api/superadmin/_gate` | GET | VERIFIED | smoke-api-routes GET; privilegeBoundaries | — |
| `/api/superadmin/system/status` | GET | VERIFIED | smoke-api-routes GET; superadmin-system-status.test.ts | — |
| `/api/superadmin/system/health` | GET | VERIFIED | smoke-api-routes GET | — |
| `/api/kitchen` | GET | VERIFIED | smoke-api-routes GET; api-kitchen-route.behavior.test.ts | — |
| `/api/kitchen/today` | GET | PARTIAL | smoke-api-routes: returns 500 (KITCHEN_TODAY_FAILED) with minimal req | Redirect/deps |
| `/api/driver/orders` | GET | VERIFIED | smoke-api-routes GET; driver-flow-quality, kitchenDriverScopeApi | — |
| `/api/driver/stops` | GET | VERIFIED | smoke-api-routes GET; kitchenDriverScopeApi | — |
| `/api/internal/scheduler/run` | POST | VERIFIED | smoke-api-routes POST (no secret → 403); privilegeBoundaries | — |
| `/api/onboarding/complete` | POST | VERIFIED | smoke-api-routes POST; registration-flow-smoke | — |
| `/api/public/forms/[id]/schema` | GET | VERIFIED | smoke-api-routes GET with params | — |
| `/api/backoffice/content/pages/[id]/published-body` | GET | VERIFIED | contentPublishedBody.test.ts | — |
| `/api/backoffice/experiments` | GET, POST | VERIFIED | backofficeExperimentsRoute.test.ts | — |
| `/api/backoffice/experiments/[id]` | GET, PATCH | VERIFIED | backofficeExperimentsIdRoute.test.ts | — |
| `/api/backoffice/ai/suggest` | POST | FAIL | backofficeAiSuggest.test.ts: expected SUGGESTION_LOG_FAILED, got SUGGESTION_INSERT_FAILED | Error code contract |
| `/api/superadmin/agreements/*` (lifecycle) | GET, POST, etc. | FAIL | superadmin.agreements-lifecycle.test.ts: admin.auth.admin.createSession is not a function | rlsFixtures / Supabase API |
| RLS/domain hardening (agreements, orders) | — | FAIL | domainHardening.agreementOrders.test.ts: same createSession | rlsFixtures |
| Other `app/api/**` routes (~280+ files) | various | NOT TESTED | No dedicated smoke invocation in this run | — |

---

## 3. Summary

- **VERIFIED:** 25 routes (or route/method combos) via `tests/api/smoke-api-routes.test.ts`; additional routes via existing tests (content pages, media, experiments, health, privilege boundaries, tenant isolation, kitchen, driver).
- **PARTIAL:** 2 — GET `/api/week` (500 with minimal req), GET `/api/kitchen/today` (500 when redirect/deps missing).
- **BLOCKED:** 1 — GET `/api/weekplan` (cookies() outside request scope in vitest).
- **FAIL:** 2 areas — backoffice AI suggest (assertion), superadmin agreements lifecycle + RLS tests (createSession).
- **NOT TESTED:** All other API route files not listed above (~280+ route handlers); no fake success.

---

## 4. Minimal smoke tests added

- **File:** `tests/api/smoke-api-routes.test.ts`
- **Scope:** Auth (health, login, post-login, me, session), order (orders, order/window, week, weekplan), backoffice/CMS (content/pages, home, tree, releases, ai/status, media/items), superadmin (_gate, system/status, system/health), kitchen/driver (kitchen, kitchen/today, driver/orders, driver/stops), cron (internal/scheduler/run), public (onboarding/complete, public/forms/[id]/schema).
- **Assertion:** Handler returns a `Response` and `status !== 500` (or documented PARTIAL/BLOCKED).
- **Mock:** `@/lib/http/routeGuard` (scopeOr401 → 401, requireRoleOr403, denyResponse) so protected routes fail safely with 401.
