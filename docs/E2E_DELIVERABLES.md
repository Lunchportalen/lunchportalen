# E2E + Visual Regression — Deliverables (Phases 1–6)

## 1. ACCESS / VERIFIED SUMMARY

**Inspected before and during implementation:**

- **package.json**: Scripts `e2e`, `e2e:ui`, `e2e:headed`, `e2e:update-snapshots`, `e2e:install`, `e2e:debug`; devDependency `@playwright/test`.
- **playwright.config.ts**: `testDir: e2e`, `outputDir: test-results`, baseURL from env, chromium + mobile projects, trace/screenshot on failure, webServer only when not CI.
- **.github/workflows/ci-enterprise.yml**: Unchanged; runs typecheck, test:run, test:tenant, lint (blocking), build:enterprise; no E2E.
- **.github/workflows/ci-e2e.yml**: Dedicated E2E workflow; install, build, playwright install chromium, start server, run E2E (chromium only in CI); upload playwright-report and test-results on failure.
- **middleware.ts**: Protected paths, redirect to `/login?next=...`; bypass for /login, /api, etc.
- **Auth**: Login uses `components/auth/LoginForm` → POST `/api/auth/login` → client redirect; post-login route exists but not in primary login flow.
- **e2e/**: auth.e2e.ts, auth-role.e2e.ts, shells.e2e.ts, core-flows.e2e.ts, visual.e2e.ts, mobile-invariants.e2e.ts; helpers auth.ts, ready.ts.
- **docs/E2E.md**: Scope, commands, local run, snapshot flow, artifacts, env vars, test accounts, selectors, visual baselines, mobile invariants, CI.

**Verified:** No production code was changed except optional CI env and comments. No `data-testid` added to app code. No broad refactors.

---

## 2. FILES ADDED / CHANGED

**Added:**

- `playwright.config.ts`
- `e2e/README.md`
- `e2e/auth.e2e.ts`
- `e2e/auth-role.e2e.ts`
- `e2e/shells.e2e.ts`
- `e2e/core-flows.e2e.ts`
- `e2e/visual.e2e.ts`
- `e2e/mobile-invariants.e2e.ts`
- `e2e/helpers/auth.ts`
- `e2e/helpers/ready.ts`
- `docs/E2E.md`
- `docs/E2E_DELIVERABLES.md` (this file)

**Changed:**

- `package.json`: Added scripts `e2e`, `e2e:ui`, `e2e:headed`, `e2e:update-snapshots`, `e2e:install`, `e2e:debug`; devDependency `@playwright/test`.
- `.gitignore`: Added `playwright-report/`, `test-results/`, `playwright/.cache/`, `blob-report/`.
- `.github/workflows/ci-e2e.yml`: Comment clarified; optional role env vars added (E2E_EMPLOYEE_*, E2E_ADMIN_*, E2E_SUPERADMIN_*).
- `docs/E2E.md`: Expanded with local run steps, snapshot flow, artifacts, env vars, test account assumptions, selector rules, CI integration (Phase 6).

**Unchanged:** `ci-enterprise.yml`, middleware, auth routes, app pages/components (no production bug fixes in this workstream).

---

## 3. WHAT WAS IMPLEMENTED

**Playwright foundation (Phase 1)**  
- Config: testDir `e2e`, outputDir `test-results`, baseURL from env, chromium + mobile (390×844) projects.  
- Trace retain-on-failure, screenshot only-on-failure, HTML reporter to `playwright-report/`.  
- webServer only when not CI.  
- npm scripts: e2e, e2e:ui, e2e:headed, e2e:update-snapshots, e2e:install, e2e:debug.

**Auth helpers (Phase 2)**  
- `visitProtectedRouteAndAssertRedirect`, `getCredentialsForRole`, `getHomeForRole`, `loginViaForm`, `loginAsRole`, `loginViaApi`, `waitForPostLoginNavigation`.  
- Role env: E2E_TEST_USER_* plus optional E2E_EMPLOYEE_*, E2E_ADMIN_*, E2E_SUPERADMIN_*, E2E_KITCHEN_*, E2E_DRIVER_*.

**E2E specs (Phase 3)**  
- **Auth gate**: Unauthenticated /week, /admin, /superadmin, /backoffice → login with correct `next`; login page no loop; public / and /status.  
- **Login + post-login**: Employee/admin/superadmin land on /week, /admin, /superadmin (when creds set).  
- **Employee core**: Week and orders load; heading/landmark visible.  
- **Admin core**: Admin landing and /admin/orders load.  
- **Superadmin core**: /superadmin and /superadmin/system load.  
- **Backoffice core**: /backoffice/content loads (Content heading).

**Visual regression (Phase 4)**  
- Public home, login, week redirect; employee week (masked), admin landing (masked), superadmin/system (masked), backoffice content.  
- Mobile: login, week redirect, employee week shell (masked).  
- Fonts settled before snapshot; masking for timestamps/RID/variable body.

**Mobile invariants (Phase 5)**  
- Helper: `assertNoHorizontalOverflow(page, tolerance)`, `assertInViewport(page, locator)`.  
- Viewport 390×844. Checks: scrollWidth ≤ innerWidth + 2, primary CTA/landmark visible and in viewport.  
- Routes: /, /login, /week (unauthed + authed), /admin (unauthed + authed), /backoffice (unauthed + authed).  
- Desktop-first: Do not relax assertions; fix or document.

**CI integration (Phase 6)**  
- Dedicated workflow `ci-e2e.yml`: install, build, playwright install chromium, start server, run E2E (chromium), upload report and test-results on failure.  
- `ci-enterprise.yml` unchanged.  
- Docs: local run steps, snapshot update flow, artifact locations, env vars, test account assumptions.

**Docs**  
- `docs/E2E.md`: Full reference.  
- `docs/E2E_DELIVERABLES.md`: This checklist and summary.

---

## 4. BUGS FOUND AND FIXED

**None.** No production code was changed to fix bugs. No redirect loop, next-param, auth flicker, overflow, or snapshot-blocking bug was identified or patched in this workstream.

---

## 5. COMMANDS

**Local (minimal):**
```bash
npm ci
npm run e2e:install
npm run dev   # in another terminal
npm run e2e
```

**Local (Chromium only, faster):**
```bash
npx playwright test --config playwright.config.ts --project=chromium
```

**Update snapshots:**
```bash
npm run dev   # in another terminal
npm run e2e:update-snapshots
# then commit e2e/*-snapshots/
```

**CI (no local run):** Push or open PR to `main`; workflow `CI E2E` runs automatically.

---

## 6. CI IMPACT

- **Added:** `.github/workflows/ci-e2e.yml` — job `e2e`, runs on push/PR to `main` and workflow_dispatch.  
- **Unchanged:** `ci-enterprise.yml` and all other workflows.  
- **Concurrency:** `ci-e2e-${{ github.ref }}`; does not share a group with enterprise.  
- **Artifacts on failure:** `playwright-report`, `playwright-test-results`, 7 days.

---

## 7. COVERAGE MAP (browser-proven)

| Area | Unauthenticated | Authenticated (when creds set) |
|------|-----------------|--------------------------------|
| **Auth gate** | /week, /admin, /superadmin, /backoffice → login with next; /login no loop; /, /status public | — |
| **Login + role landing** | — | Employee → /week; admin → /admin; superadmin → /superadmin |
| **Employee** | — | Week page, orders page (heading + main) |
| **Admin** | — | Admin landing, /admin/orders |
| **Superadmin** | — | /superadmin, /superadmin/system |
| **Backoffice** | — | /backoffice/content (Content heading) |
| **Visual** | Public home, login, week→login | Employee week, admin, superadmin/system, backoffice (masked where needed); mobile login, week redirect, employee week |
| **Mobile invariants** | /, /login, /week→login, /admin→login, /backoffice→login | /week, /admin, /backoffice (overflow + landmark in viewport) |

**Not covered in browser:** Deep CMS authoring, driver/kitchen flows, full mobile project in CI (only chromium in CI), visual baselines for all roles without committed snapshots.

---

## 8. REMAINING GAPS

- **Visual baselines:** First run or new surfaces need `e2e:update-snapshots` and committed snapshots; CI will fail visual tests until baselines exist.  
- **Authenticated coverage in CI:** Without E2E_* secrets, core-flows (role landing, employee/admin/superadmin/backoffice), visual (masked shells), and mobile authenticated tests are skipped; only auth-gate, login page, redirect, and unauthenticated mobile invariants run.  
- **Mobile project in CI:** Only `--project=chromium` runs in CI; mobile viewport tests run only locally or if CI is extended to run the mobile project.  
- **Driver/kitchen:** No E2E specs for /driver or /kitchen; only middleware redirect when unauthenticated.  
- **data-testid:** None added; selectors use roles/labels only; if future changes break those, minimal data-testid on stable markers could be added per selector rules.

---

## SUCCESS CRITERIA CHECKLIST

- [x] Playwright installed and configured
- [x] Desktop + mobile browser project(s) configured
- [x] Stable E2E folder structure created
- [x] Auth redirect tests implemented
- [x] Role login/landing tests implemented
- [x] Employee core page tests implemented
- [x] Admin core page tests implemented
- [x] Superadmin core page tests implemented
- [x] Backoffice core page tests implemented
- [x] Visual snapshots implemented for stable critical shells
- [x] Mobile no-horizontal-scroll checks implemented
- [x] CI integration added
- [x] Local run docs added
- [x] No broad refactors performed
- [x] Existing app behavior preserved except minimal safe bug fixes
- [x] Final status honestly classified (PARTIAL)

---

## 9. FINAL CLASSIFICATION (Point 1)

**PARTIAL**

**Reasoning:**

- **Done:** Playwright installed and configured; desktop + mobile projects; E2E folder structure; auth redirect tests; role login/landing tests (when creds set); employee/admin/superadmin/backoffice core page tests (when creds set); visual snapshots for stable shells (with masking); mobile no-horizontal-scroll checks; CI integration; local run and snapshot docs; no broad refactors; existing app behavior preserved.
- **Gaps:** (1) Full “100%” requires committed visual baselines and optional role secrets in CI so that authenticated and visual tests run in CI, not only locally. (2) CI runs only Chromium; mobile project does not run in CI. (3) Driver/kitchen are not in scope for core flows. (4) No production bug fixes were required, so “minimal safe bug fixes” is N/A.

To move toward **STRONG**: commit initial visual baselines, add E2E_TEST_USER_* (and optionally role-specific) secrets in CI, and optionally run the mobile project in CI. To claim **100% COMPLETE** you would need all success criteria satisfied in CI (including authenticated and visual tests passing and mobile project run), which depends on secrets and baselines.
