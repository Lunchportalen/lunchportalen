# Browser E2E and Visual Regression

Production-grade browser E2E and visual regression for Lunchportalen. Compliant with AGENTS.md (no business logic changes, deterministic, fail-closed).

## Scope

- **Auth and redirect**: Unauthenticated → `/login?next=...`, no login loop, role landing.
- **Shells**: Public front, login, week, admin, superadmin, backoffice, driver, kitchen (redirect or content).
- **Visual regression (Phase 4)**: Public home, login, week redirect, employee week (masked), admin landing (masked), superadmin/system (masked), backoffice content; mobile: login, week redirect, employee week shell (masked).
- **Mobile invariants (Phase 5)**: On 390×844 viewport: scrollWidth ≤ innerWidth + tolerance, no horizontal overflow, primary nav/CTA visible and in viewport for /, /login, /week, /admin, /backoffice. Authenticated /week, /admin, /backoffice require creds. If a route is desktop-first, fix or document; we do not fake compliance.

## Prerequisites

- Node 20+
- App running at `http://localhost:3000` (or set `PLAYWRIGHT_BASE_URL`).

## Commands

| Command | Description |
|--------|--------------|
| `npm run e2e` | Run all E2E tests (starts dev server if not CI) |
| `npm run e2e:ui` | Run with Playwright UI |
| `npm run e2e:headed` | Run in headed browser |
| `npm run e2e:update-snapshots` | Update visual regression snapshots |
| `npm run e2e:install` | Install browser binaries only |
| `npm run e2e:debug` | Run in debug mode |

## First-time setup

1. Install deps: `npm ci`
2. Install browsers: `npm run e2e:install`
3. Start app: `npm run dev` (in another terminal)
4. Run E2E: `npm run e2e`
5. If visual tests fail (missing baselines):  
   `npx playwright test visual --update-snapshots`  
   then commit the generated files under `e2e/` (e.g. `e2e/visual.e2e.ts-snapshots/`).

## Authenticated tests (optional)

Set env for login + role-landing specs. **No seeded test users in repo**; use local or CI secrets only.

### Single test user (minimum)

- `E2E_TEST_USER_EMAIL` — test user email
- `E2E_TEST_USER_PASSWORD` — test user password

If unset, auth-role and authenticated shell tests are skipped. In CI, configure as repo secrets to run full coverage. Role is whatever this user has in the DB (profile/metadata).

### Role-specific accounts (local-only, optional)

For role-aware helpers (`getCredentialsForRole`, `loginAsRole`) you can set per-role env so one test run can assert employee, admin, and superadmin without changing env:

| Role            | Email env                 | Password env                 |
|-----------------|---------------------------|------------------------------|
| employee        | `E2E_EMPLOYEE_EMAIL`      | `E2E_EMPLOYEE_PASSWORD`      |
| company_admin   | `E2E_ADMIN_EMAIL`         | `E2E_ADMIN_PASSWORD`         |
| superadmin      | `E2E_SUPERADMIN_EMAIL`    | `E2E_SUPERADMIN_PASSWORD`    |
| kitchen         | `E2E_KITCHEN_EMAIL`       | `E2E_KITCHEN_PASSWORD`      |
| driver          | `E2E_DRIVER_EMAIL`        | `E2E_DRIVER_PASSWORD`       |

If a role-specific pair is missing, helpers fall back to `E2E_TEST_USER_EMAIL` / `E2E_TEST_USER_PASSWORD`. Create these accounts in your local Supabase (or dev env) only; **do not embed or assume production credentials**.

## Local run (exact steps)

1. **Install dependencies**: `npm ci`
2. **Install browser binaries**: `npm run e2e:install` (or `npx playwright install --with-deps chromium` for Chromium only)
3. **Start the app** (in a separate terminal): `npm run dev` — app must be reachable at `http://localhost:3000` (or set `PLAYWRIGHT_BASE_URL`)
4. **Run all E2E tests**: `npm run e2e`
5. **Run only Chromium (faster)**: `npx playwright test --config playwright.config.ts --project=chromium`
6. **Run with UI**: `npm run e2e:ui`
7. **Run headed**: `npm run e2e:headed`

## Snapshot update flow

1. Run the app: `npm run dev`
2. Update visual baselines: `npm run e2e:update-snapshots` (or `npx playwright test visual --update-snapshots` for visual specs only)
3. Commit the generated files under `e2e/` (e.g. `e2e/visual.e2e.ts-snapshots/`). Do not commit `playwright-report/` or `test-results/`.

## Where artifacts go

- **Local**: `test-results/` (screenshots, traces, videos on failure), `playwright-report/` (HTML report). Both are in `.gitignore`.
- **CI (on failure)**: Artifacts `playwright-report` and `playwright-test-results` are uploaded to the workflow run; retention 7 days. Download from the Actions run page.

## CI integration (Phase 6)

- **Workflow**: `.github/workflows/ci-e2e.yml` (dedicated; `ci-enterprise.yml` is unchanged).
- **Triggers**: push/PR to `main`, `workflow_dispatch`.
- **Job**: `e2e` — checkout, Node 20, `npm ci`, verify required secrets, `npm run build`, `npx playwright install --with-deps chromium`, start server (background), wait for http://localhost:3000, run `npx playwright test --config playwright.config.ts --project=chromium`, on failure upload `playwright-report` and `test-results`.
- **Deterministic mode**: Production build (`npm run build`) + `npm run start`; no dev server in CI.
- **Concurrency**: `ci-e2e-${{ github.ref }}` so E2E does not block or get blocked by other workflows.

## Test helpers (Phase 2)

- **Auth** (`e2e/helpers/auth.ts`): `visitProtectedRouteAndAssertRedirect`, `loginViaForm`, `loginAsRole`, `getCredentialsForRole`, `loginViaApi` (programmatic via `/api/auth/login-debug`), `waitForPostLoginNavigation`.
- **Ready** (`e2e/helpers/ready.ts`): `waitForMainContent`, `assertProtectedShellReady`, `assertLoginPageReady`.

Prefer UI login for full flow; use `loginViaApi` only when you need session without UI (e.g. same auth semantics, no form interaction). No hacks that bypass real auth.

## Mobile invariants (Phase 5)

- **Helper**: `assertNoHorizontalOverflow(page, tolerance?)` and `assertInViewport(page, locator)` in `e2e/helpers/ready.ts`.
- **Viewport**: 390×844. Checks: `scrollWidth <= innerWidth + 2`, primary CTA/nav/landmark visible and within viewport.
- **Routes**: /, /login, /week (unauthenticated and authenticated), /admin (unauthenticated and authenticated), /backoffice (unauthenticated and authenticated). Authenticated tests skip when role creds are missing.
- **Desktop-first**: If a route fails (e.g. horizontal overflow on 390px), fix the layout or document in this file that the route is desktop-first; do not relax or remove the assertion.

## Expected environment variables (CI and local)

- **Required for app (and E2E)**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. In CI these are secrets.
- **Optional for E2E**: `PLAYWRIGHT_BASE_URL` (default `http://localhost:3000`), `E2E_TEST_USER_EMAIL`, `E2E_TEST_USER_PASSWORD`, and role-specific `E2E_EMPLOYEE_*`, `E2E_ADMIN_*`, `E2E_SUPERADMIN_*`. See "Authenticated tests" above.

## Test account / setup assumptions

- **No seeded test users in the repo.** Use local Supabase (or dev) to create accounts; set env (or CI secrets) for authenticated tests.
- **Single user**: Set `E2E_TEST_USER_EMAIL` and `E2E_TEST_USER_PASSWORD`; role is whatever that user has in the DB.
- **Role-specific**: Set per-role env for employee, admin, superadmin to run core flows and visual/mobile authenticated tests without changing env between runs.
- **Do not use production credentials.** Do not embed passwords in code or docs.

## Selector and stability rules

1. **Prefer**: Accessible roles and names (`getByRole`, `getByLabel`, `getByRole('heading', { name: /.../ })`).
2. **If needed**: Explicit `data-testid` only where necessary and only on stable shell markers or critical controls; none were added in this workstream.
3. **Do not**: Chain fragile CSS selectors; depend on incidental text that is likely to change; use `waitForTimeout` or arbitrary sleeps unless there is no alternative.
4. **Prefer**: `expect(page).toHaveURL(...)`, `expect(locator).toBeVisible()`, explicit readiness (e.g. `assertLoginPageReady`, `waitForMainContent`). Use network-idle only when appropriate.

## Visual baselines (Phase 4)

- Stored next to the test file (e.g. `e2e/visual.e2e.ts-snapshots/`).
- **Targets**: public home, login, week redirect, employee week, admin landing, superadmin/system, backoffice content; mobile: login, week redirect, employee week shell.
- **Masking**: Timestamps, RID, health metrics, and variable body content are masked on employee week, admin landing, and superadmin/system so only shell/chrome is compared. Fonts are settled (`document.fonts.ready`) before each snapshot.
- Commit baselines so CI can compare. Use `npm run e2e:update-snapshots` only when layout/intent changes.
