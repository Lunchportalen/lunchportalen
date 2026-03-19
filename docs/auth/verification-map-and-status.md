# Auth verification map and status

Senior auth QA view: login UI, submit/request path, response handling, redirect after success, protected-route behavior. Auth flow is only marked VERIFIED where the request path actually fires and result/redirect is truthful (no fake loading, no silent false-success).

---

## 1. Auth verification map

| Layer | Detail |
|-------|--------|
| **Login UI** | app/(auth)/login/page.tsx → LoginForm (LoginForm.tsx). Fields: email, password. Button "Logg inn" → onLogin(). No client-side redirect; submit triggers real calls. |
| **Submit / request** | 1) signInWithPassword(email, password) via Supabase browser client. 2) On success: POST /api/auth/post-login with body { access_token, refresh_token, next }. 3) On 303: window.location.assign GET /api/auth/post-login?next=... (DB-truth routing). resolveNext(next) blocks /login, external, /api; allow-list for /week, /admin, /superadmin, etc. |
| **Response handling** | If !resp.ok && status !== 303: setErr(text or HTTP status); setBusy(false); no redirect. If 303: hard redirect to GET post-login. Invalid signIn → setErr(error.message), no POST. Empty email/password → setErr("Fyll inn e-post og passord."), no network. |
| **Redirect after success** | GET /api/auth/post-login: getAuthContext(); !auth.ok && UNAUTHENTICATED → 303 /login?code=NO_SESSION. Else allowNextForRole(role, next) ?? homeForRole(role) → 303 to target. Role home: superadmin→/superadmin, company_admin→/admin, kitchen→/kitchen, driver→/driver, else /week. |
| **Redirect when unauthenticated** | Middleware: isProtectedPath (/week, /superadmin, /admin, /backoffice, /orders, /driver, /kitchen). No user → 303 /login?next=<pathname+search>. Layouts: backoffice layout getAuthContext(); !ok && UNAUTHENTICATED → redirect(/login?next=...). Other protected layouts (admin, superadmin, kitchen, driver, portal) same pattern. |
| **Role / protected route** | post-login GET: allowNextForRole restricts next by role (employee only /week, /orders; admin /admin; etc.). Backoffice layout: auth.role !== "superadmin" → redirect(roleHome(role)). Middleware does not decide role landing; layouts do. |

---

## 2. Status matrix

| AUTH AREA | STATUS | EVIDENCE | FAILURE LAYER | EXACT FILES INVOLVED |
|-----------|--------|----------|---------------|----------------------|
| **/login loads** | VERIFIED | E2E: auth.e2e.ts "login page renders and has no redirect loop"; "direct navigation to /login does not redirect to /login again". assertLoginPageReady (heading + form). Mobile: /login no horizontal overflow, CTA visible. | — | app/(auth)/login/page.tsx, LoginForm.tsx; e2e/auth.e2e.ts, e2e/mobile-invariants.e2e.ts, e2e/helpers/ready.ts |
| **Credential submit triggers real request path** | VERIFIED | Unit: login-form-submit.test.tsx — submit sends signInWithPassword then fetch POST /api/auth/post-login with URL, method POST, body access_token, refresh_token, next. E2E: auth.e2e.ts invalid credentials → error text visible, stay on /login (request sent, response handled). | signInWithPassword error → no POST; POST 4xx/5xx → setErr | LoginForm.tsx; tests/auth/login-form-submit.test.tsx; e2e/auth.e2e.ts |
| **Loading state truthful** | VERIFIED | login-form-submit.test.tsx: during request button disabled and text "Logger inn…"; invalid creds → error shown, no POST; empty → validation, no network. E2E auth-redirect-safety: "no permanent disabled loading state" if still on /login. | — | LoginForm.tsx; tests/auth/login-form-submit.test.tsx |
| **Success redirects to safe next** | VERIFIED | post-login GET: allowNextForRole + homeForRole; postLoginRedirectSafety.test.ts: unsafe next → /week; employee + next=/admin → /week. E2E: loginAsRole to /backoffice/content → toHaveURL(/backoffice/content/). statusPageHelpers: primaryHref uses /api/auth/post-login?next=. | GET post-login getAuthContext; allowNextForRole | app/api/auth/post-login/route.ts; tests/auth/postLoginRedirectSafety.test.ts; e2e/auth-redirect-safety.e2e.ts |
| **Failure shows real error** | VERIFIED | LoginForm: !resp.ok && status !== 303 → setErr(text or HTTP status). Invalid signIn → setErr(error.message). Unit: invalid credentials → .border-red-200 with "Invalid login credentials". E2E: "invalid credentials: submit sends request, shows error, no redirect". | — | LoginForm.tsx; tests/auth/login-form-submit.test.tsx; e2e/auth.e2e.ts |
| **Protected route redirects when unauthenticated** | VERIFIED | Middleware: unauthenticated /admin, /week, /superadmin, /backoffice → 303 /login?next=... (middlewareRedirectSafety.test.ts). E2E: visitProtectedRouteAndAssertRedirect(/backoffice/content), /week, /admin, /superadmin → /login with next. auth-redirect-safety: next param internal only. | Middleware getUser; layout getAuthContext | middleware.ts; app/(backoffice)/backoffice/layout.tsx; tests/middleware/middlewareRedirectSafety.test.ts; e2e/auth.e2e.ts, e2e/auth-redirect-safety.e2e.ts, e2e/helpers/auth.ts |
| **Authenticated access consistent** | VERIFIED | E2E: loginViaForm then waitForPostLoginNavigation; toHaveURL(/backoffice/content/). core-flows "backoffice content shell loads after auth". mobile-invariants /backoffice/content authenticated. | — | e2e/auth-redirect-safety.e2e.ts, e2e/core-flows.e2e.ts, e2e/mobile-invariants.e2e.ts |
| **POST post-login missing tokens → safe redirect** | VERIFIED | API: POST body without access_token/refresh_token → 303 /login?code=NO_TOKENS (post-login-api.test.ts). | NO_TOKENS | app/api/auth/post-login/route.ts; tests/auth/post-login-api.test.ts |
| **GET post-login unauthenticated → safe redirect** | VERIFIED | API: getAuthContext returns UNAUTHENTICATED → 303 /login?code=NO_SESSION (post-login-api.test.ts). Smoke: GET post-login non-500. | NO_SESSION | app/api/auth/post-login/route.ts; lib/auth/getAuthContext.ts; tests/auth/post-login-api.test.ts; tests/api/smoke-api-routes.test.ts |
| **/backoffice redirect protection** | VERIFIED | Middleware: /backoffice in isProtectedPath; no user → /login?next=.... Layout: getAuthContext(); !ok → redirect(/login?next=...); role !== superadmin → redirect(roleHome). E2E: unauthenticated /backoffice/content → /login; next contains /backoffice. | Middleware + layout | middleware.ts; app/(backoffice)/backoffice/layout.tsx; e2e/auth.e2e.ts, e2e/auth-redirect-safety.e2e.ts, e2e/mobile-invariants.e2e.ts |

---

## 3. E2E / unit evidence summary

- **Request path fires:** login-form-submit.test.tsx asserts fetch called with /api/auth/post-login, POST, body with tokens and next. Invalid creds assert no POST and error div. E2E invalid credentials shows error text.
- **No fake loading loop:** Button disabled and "Logger inn…" only during request; after error or empty validation, no infinite loading.
- **Protected route:** Middleware + layout; E2E visitProtectedRouteAndAssertRedirect and backoffice redirect tests.

---

## 4. Exact files (summary)

| Role | Files |
|------|--------|
| Login UI | app/(auth)/login/page.tsx, app/(auth)/login/LoginForm.tsx |
| Post-login API | app/api/auth/post-login/route.ts |
| Auth context | lib/auth/getAuthContext.ts |
| Middleware | middleware.ts |
| Protected layouts | app/(backoffice)/backoffice/layout.tsx, app/admin/layout.tsx, app/superadmin/layout.tsx, app/(portal)/layout.tsx, app/kitchen/layout.tsx, app/driver/layout.tsx |
| Tests | tests/auth/login-form-submit.test.tsx, tests/auth/postLoginRedirectSafety.test.ts, tests/auth/post-login-api.test.ts, tests/middleware/middlewareRedirectSafety.test.ts, tests/api/smoke-api-routes.test.ts |
| E2E | e2e/auth.e2e.ts, e2e/auth-redirect-safety.e2e.ts, e2e/mobile-invariants.e2e.ts, e2e/helpers/auth.ts, e2e/helpers/ready.ts |
