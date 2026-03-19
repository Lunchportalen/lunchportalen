# TESTING / CI DISCOVERY REPORT

**Scope:** Verified map of testing and CI system. No code changed. Gaps are identified from config and AGENTS.md only.

**Date:** 2025-03-14

---

## 1) RUNNERS IN USE

| Runner | Config file | Environment | Notes |
|--------|-------------|-------------|--------|
| **Vitest** | `vitest.config.ts` | Node | Single config; `vite-tsconfig-paths`, `server-only` mock; timeout/hook 120s |
| **Playwright** | `playwright.config.ts` | Browser (Chromium + iPhone 14 viewport) | `e2e/`; CI: 2 workers, 1 retry, `forbidOnly` in CI; no webServer in CI (server started in workflow) |
| **Jest** | — | — | **Not used** (no jest.config) |

**Relevant files:**
- `package.json` (scripts: test, test:run, test:tenant, test:db, e2e, e2e:*)
- `vitest.config.ts`
- `playwright.config.ts`
- `tests/_mocks/server-only.ts`

---

## 2) CI WORKFLOWS FOUND

| Workflow | File | Triggers | Purpose |
|----------|------|----------|---------|
| **CI** | `.github/workflows/ci.yml` | push main, PR | Full gate: ci:guard → typecheck → test:run → test:tenant → lint:ci → verify secrets → build:enterprise → seo-proof → seo-audit → seo-content-lint |
| **CI Enterprise** | `.github/workflows/ci-enterprise.yml` | push main, PR, workflow_dispatch, cron 03:00 | Enterprise gate: env verify → PROOF steps → typecheck → test:run → test:tenant → lint:ci (non-blocking) → audit:api → audit:repo → check:admin-copy → agents:check → build:enterprise |
| **CI (AGENTS gate)** | `.github/workflows/ci-agents.yml` | push main, PR | agents:check → typecheck → **lint** (strict) → build:enterprise |
| **CI E2E** | `.github/workflows/ci-e2e.yml` | push main, PR, workflow_dispatch | Build → Playwright install chromium → start server → `npx playwright test --project=chromium`; upload report on failure |
| **Supabase Migrate** | `.github/workflows/supabase-migrate.yml` | PR all branches, push main, workflow_dispatch | Staging (PR): migration-gate → db push → db-contracts → cron-smoke → typegen. Prod (push main): same. No typecheck/lint/unit. |
| **postdeploy-gate** | `.github/workflows/postdeploy.yml` | workflow_run (CI AGENTS gate completed), workflow_dispatch | Runs only when CI (AGENTS) succeeds and head is main. Runs `npm run postdeploy`. |
| **Codex Audit Autofix** | `.github/workflows/codex-audit-autofix.yml` | schedule 20:00, workflow_dispatch | Runs ci:critical; on failure, optional autofix + PR. |
| **Codex Design System** | `.github/workflows/codex-design-system.yml` | schedule 20:15, workflow_dispatch | Design patches; no gate run. |
| **Auto-merge** | `.github/workflows/automerge-lowrisk.yml` | PR labeled/sync/reopen/ready | Enables squash auto-merge when PR has `risk:low`. |
| **Deps weekly** | `.github/workflows/deps-weekly.yml` | schedule Mon 06:00, workflow_dispatch | npm update + audit fix; then ci:critical; then PR. |
| **Security audit** | `.github/workflows/security-audit.yml` | schedule 07:00, workflow_dispatch | `npm audit --audit-level=high`. |

---

## 3) COMMANDS CURRENTLY ENFORCED

### In CI (ci.yml) — single job, sequential
1. `npm run ci:guard`
2. `npm run typecheck`
3. `npm run test:run`
4. `npm run test:tenant`
5. `npm run lint:ci`
6. Verify required secrets (bash)
7. `npm run build:enterprise` (includes agents:check, audit:api, audit:repo, check:admin-copy, next build, seo-proof, seo-audit, seo-content-lint)
8. `node scripts/seo-proof.mjs` (redundant with build:enterprise)
9. `node scripts/seo-audit.mjs` (redundant)
10. `node scripts/seo-content-lint.mjs` (redundant)

### In CI Enterprise (ci-enterprise.yml)
1. Verify required env (SYSTEM_MOTOR_SECRET, Supabase, no Sanity required in this step)
2. PROOF / guard steps (audit-repo.mjs existence, no legacy .js)
3. typecheck → test:run → test:tenant → **lint:ci (documented non-blocking)** → audit:api → audit:repo
4. check:admin-copy → agents:check → build:enterprise

### In CI Agents (ci-agents.yml)
1. agents:check
2. typecheck
3. **lint** (strict; fails on lint errors)
4. build:enterprise

### In CI E2E (ci-e2e.yml)
1. Verify env (Supabase only)
2. **`npm run build`** (plain Next build, not build:enterprise)
3. Playwright install chromium
4. Start server + `npx playwright test --config playwright.config.ts --project=chromium`

### Typecheck gate
- **Enforced in:** ci.yml, ci-enterprise.yml, ci-agents.yml
- **Not run in:** ci-e2e.yml, supabase-migrate, postdeploy, codex-*, deps-weekly (deps-weekly runs ci:critical which includes typecheck), security-audit

### Lint gate
- **Strict (`lint`):** ci-agents.yml only
- **Non-blocking (`lint:ci`):** ci.yml, ci-enterprise.yml (explicitly “non-blocking” in ci-enterprise)
- **Not run:** ci-e2e.yml, supabase-migrate, postdeploy

---

## 4) COVERAGE AREAS (VERIFIED FROM FILES)

### Unit / integration (Vitest)
- **Config:** `vitest.config.ts`; entry: `npm run test:run` (all) or `test:tenant` (single file), `test:db` (db integrity).
- **Locations:** `tests/**/*.test.ts`, `tests/**/*.test.tsx` (e.g. api/, lib/, cms/, security/, rls/, auth/, middleware/, system/, backoffice/, ai/, env/, motion/, components/, kitchen/, driver-flow, registration-flow-smoke, etc.).
- **Special:** `tests/tenant-isolation.test.ts` (and sibling tenant-* tests) used as dedicated tenant gate; `tests/db/database-integrity.test.ts` for DB (script `test:db`); not run in any workflow.

### E2E (Playwright)
- **Config:** `playwright.config.ts`; `testDir: "e2e"`; projects: chromium, mobile (iPhone 14).
- **CI E2E workflow:** runs only `--project=chromium` (mobile project not run in CI).
- **Files:** `e2e/core-flows.e2e.ts`, `e2e/auth.e2e.ts`, `e2e/auth-role.e2e.ts`, `e2e/visual.e2e.ts`, `e2e/shells.e2e.ts`, `e2e/mobile-invariants.e2e.ts`, `e2e/helpers/ready.ts`, `e2e/helpers/auth.ts`.
- **Auth E2E:** Depends on env (E2E_EMPLOYEE_EMAIL, E2E_ADMIN_EMAIL, E2E_SUPERADMIN_EMAIL, etc.); tests skip when creds missing.

### Sanity / live
- **Script:** `scripts/sanity-live.mjs` (`npm run sanity:live`). Hits live base URL (env), health + optional cron. Documented as soft gate when unreachable.
- **Not run in any GitHub Actions workflow.**

---

## 5) CRITICAL GAPS PREVENTING ≥100% (AGENTS.md ALIGNMENT)

AGENTS.md K11 and C3 state that a change is DONE only when:
- build:enterprise passes  
- typecheck passes  
- lint passes  
- **sanity:live passes**  
- required tests pass  

Verified gaps:

| Gap | Detail | Files / location |
|-----|--------|-------------------|
| **sanity:live not in CI** | No workflow runs `npm run sanity:live`. AGENTS.md lists it as required. | All `.github/workflows/*.yml`; `package.json` (script exists); `scripts/sanity-live.mjs` |
| **Lint not a hard gate on main/PR** | ci.yml and ci-enterprise use `lint:ci`, which exits 0 on failure (`next lint \|\| node -e "process.exit(0)"`). Only ci-agents uses strict `lint`. So PRs can merge (via ci.yml or ci-enterprise) with lint failures. | `package.json` (lint:ci); `.github/workflows/ci.yml` (lint:ci); `.github/workflows/ci-enterprise.yml` (lint:ci, commented “non-blocking”) |
| **test:db never run in CI** | `test:db` (database-integrity) exists and is documented but not invoked in any workflow. | `package.json`; `tests/db/database-integrity.test.ts`; `.github/workflows/` (no reference) |
| **E2E uses plain build** | ci-e2e runs `npm run build`, not `npm run build:enterprise`. Enterprise audits/SEO/agents are not run before E2E. | `.github/workflows/ci-e2e.yml` |
| **E2E mobile project not run in CI** | Playwright defines `chromium` and `mobile` (iPhone 14); CI runs only `--project=chromium`. Mobile viewport E2E not in CI. | `playwright.config.ts`; `.github/workflows/ci-e2e.yml` |

---

## 6) DUPLICATED / REDUNDANT BEHAVIOUR

| Item | Detail |
|------|--------|
| **SEO steps in ci.yml** | ci.yml runs seo-proof, seo-audit, seo-content-lint again after build:enterprise; build:enterprise already runs them. Redundant. |
| **Three overlapping “main” gates** | ci.yml, ci-enterprise.yml, and ci-agents.yml all run on push to main and PR. They run similar but not identical steps (typecheck, tests, lint variant, build). Order and failure semantics differ (e.g. lint strict only in ci-agents). |
| **postdeploy triggered by ci-agents** | postdeploy-gate runs after “CI (AGENTS gate)” succeeds and head is main. So it’s tied to ci-agents, not to ci.yml or ci-enterprise. |

---

## 7) FAIL-FAST PROTECTIONS

| Aspect | Status |
|--------|--------|
| **Concurrency** | ci, ci-enterprise, ci-e2e use `cancel-in-progress: true`. Others use `false` or default. |
| **Explicit fail-fast** | No workflow sets `fail-fast: false`; jobs run sequentially within each workflow, so first failure stops the job. |
| **continue-on-error** | Not used in any workflow. |
| **lint:ci** | Deliberately does not fail the pipeline (exit 0 on lint failure). Reduces fail-fast for lint. |

---

## 8) CONFIG FILES REFERENCE

| Purpose | File(s) |
|---------|--------|
| Package scripts | `package.json` |
| Vitest | `vitest.config.ts` |
| Playwright | `playwright.config.ts` |
| ESLint | `.eslintrc.cjs` (extends next/core-web-vitals, next/typescript; several rules off) |
| TypeScript | `tsconfig.json` (strict: false; exclude studio/) |
| Next | `next.config.ts` (minimal; headers for /og) |
| CI guard | `scripts/ci-guard.mjs` |
| Agents gate | `scripts/agents-ci.mjs` |
| Sanity live | `scripts/sanity-live.mjs` |
| Lint CI helper | `scripts/lint-ci.mjs` (always exit 0) |

---

## 9) SUMMARY

- **Runners:** Vitest (unit/integration), Playwright (e2e). No Jest.
- **Workflows:** 11 YAML files; 4 “gate” workflows (ci, ci-enterprise, ci-agents, ci-e2e) on main/PR; rest are scheduled or event-driven.
- **Commands enforced:** typecheck and test:run + test:tenant in all main gates; build:enterprise in ci, ci-enterprise, ci-agents; lint is strict only in ci-agents; lint:ci used elsewhere and is non-blocking.
- **Critical gaps:** sanity:live not in CI; lint not a hard gate in ci/ci-enterprise; test:db not in CI; ci-e2e uses plain build and chromium-only.
- **Duplication:** SEO steps duplicated in ci.yml; three overlapping main/PR workflows with different lint behaviour.
- **Fail-fast:** No continue-on-error; lint:ci softens fail-fast for lint.

**Exact files involved** for hardening (no changes made in this discovery):
- `.github/workflows/ci.yml`
- `.github/workflows/ci-enterprise.yml`
- `.github/workflows/ci-agents.yml`
- `.github/workflows/ci-e2e.yml`
- `package.json` (lint vs lint:ci; optional sanity:live/test:db in CI)
- `scripts/sanity-live.mjs` (if sanity:live is added to CI)
- `playwright.config.ts` (if mobile project is added to CI)

---

## 10) CI WORKFLOW HARDENING (APPLIED)

**Date:** 2025-03-14

Normalization applied so the main CI path clearly runs **typecheck → lint → test → build** with explicit failure.

| File | Changes |
|------|--------|
| **ci.yml** | Main path: reordered to typecheck → Lint → test:run → test:tenant → verify secrets → build:enterprise. Replaced `lint:ci` with `lint` (explicit failure). Removed redundant post-build SEO steps (already inside build:enterprise). Added header comment. |
| **ci-enterprise.yml** | Gate step now runs `lint` instead of `lint:ci` so the enterprise gate fails on lint errors. |
| **ci-agents.yml** | Added "Run tests" and "Tenant isolation test" so this workflow enforces the full gate (typecheck, lint, test, build). |
| **ci-e2e.yml** | Added Typecheck and Lint before build. Replaced `npm run build` with `npm run build:enterprise` and required env for that step so E2E runs on the same build as main CI. |

**Result:** All four gate workflows now enforce typecheck, lint, test, and build in a sensible order; lint is a hard gate; no duplicate SEO steps; E2E uses the enterprise build. No new platform or matrix; logic unchanged except order and strict lint.

---

## 11) CI FAIL-FAST HARDENING (APPLIED)

**Date:** 2025-03-14

Tightened so critical verification failures are not swallowed when scripts are used (e.g. deps-weekly, codex-audit-autofix).

| Location | Change |
|----------|--------|
| **package.json** | `preflight` and `ci:enterprise` now call `npm run lint` instead of `npm run lint:ci`. Any run of `npm run ci:critical` or `npm run preflight` (including from deps-weekly and codex-audit-autofix) now fails on lint. |

**Verified:** No workflow uses `continue-on-error`. Critical steps use discrete `run:` steps or `set -euo pipefail` in bash blocks. The `lint:ci` script remains in package.json for optional non-blocking local use; it is not used in any CI workflow or in ci:enterprise/preflight.

---

## 12) CRITICAL TEST COVERAGE HARDENING (APPLIED)

**Date:** 2025-03-14

Focused tests added only for verified high-risk surfaces; no coverage theater.

| Surface | File | What it proves |
|---------|------|----------------|
| **Cron auth gate** | `tests/lib/http/cronAuth.test.ts` | requireCronAuth throws with correct codes (cron_secret_missing, forbidden) and returns { mode } when Bearer or x-cron-secret matches. Auth/role denial for cron. |
| **Cron outbox route helper** | `tests/api/cronOutboxAuth.test.ts` | New test: OUTBOX_BATCH_SIZE env overflow is clamped to max 200; processOutboxBatch is called with clamped value. Route helper correctness and outbox/cron safety. |

**Existing coverage (unchanged):** tenant isolation, auth/role guards, outbox policy, routeGuard, preview parity, editor AI, and DB integrity already have tests. No new tests for schema/migration replay (database-integrity.test.ts already covers when DB present); no new E2E or matrix.

---

## 13) TEST STABILITY HARDENING (APPLIED)

**Date:** 2025-03-14

Fixes for verified flaky/unstable behavior only; no broad suite rewrites.

| Cause | Fix |
|-------|-----|
| **Shared mutable orgnr** | rlsFixtures: orgnr is now per-build from rid (`orgnrBaseFromRid(rid)` + offset). No module-level counter; parallel runs no longer collide on `companies_orgnr_uq`. |
| **afterEach cleanup when beforeEach failed** | superadmin.agreements-lifecycle, domainHardening.agreementOrders, tenantIsolation.final: `afterEach` uses `if (fx?.cleanup) await fx.cleanup()` so teardown never runs on undefined when fixture build threw. |
| **Middleware redirect URL** | middlewareRedirectSafety: `nextUrl.clone()` now returns a real `URL` instance so `NextResponse.redirect(u)` gets a valid URL instead of `[object Object]`. |
| **Env assumption in middleware test** | "Fail closed to /status" test no longer deletes env (overridden by test defaults). It mocks `getSupabasePublicConfig` to throw once so the fail-closed path is asserted deterministically. |
| **Supabase mock insert return shape** | publishFlow: mock `insert()` now returns `Promise.resolve({ data: { id }, error: null })` so `copyVariantBodyToProd` does not destructure undefined. |
| **Schema variance (company_locations.label)** | rlsFixtures insertLocation: if insert fails with label/schema error, retries without `label` so fixtures work when the column is missing. |

**Not changed:** RLS/agreement tests that require real Supabase auth (e.g. `createSession`) still depend on local/CI Supabase API; failures there are environment/API, not flakiness.

---

## 14) BUILD GATE ENFORCEMENT (APPLIED)

**Date:** 2025-03-14

Production build verification is a required blocking gate in all main CI paths.

| Item | Detail |
|------|--------|
| **Production build command** | `npm run build:enterprise` (package.json). Runs agents:check, audit:api, audit:repo, check:admin-copy, next build, seo-proof, seo-audit, seo-content-lint. |
| **CI reference** | All four gate workflows run the same command: `npm run build:enterprise` as a discrete step with no continue-on-error. |
| **Workflows** | ci.yml, ci-enterprise.yml, ci-agents.yml, ci-e2e.yml each have a "Build (Enterprise)" / "Build enterprise" step; comments added to state the step is a required gate. |
| **Downstream** | deps-weekly and codex-audit-autofix run `npm run ci:critical` (which runs build:enterprise), so they also enforce the build. |

**Validation:** CI references the same build path (build:enterprise) everywhere; no workflow uses plain `npm run build` for the main verification path.

---

## 15) TEST ENVIRONMENT NORMALIZATION (APPLIED)

**Date:** 2025-03-14

Test environment assumptions aligned between local and CI so `isTestEnv()` and test-default config behave the same.

| Location | Change |
|----------|--------|
| **vitest.config.ts** | Set `NODE_ENV = "test"` and `VITEST = "true"` when not already set, so local and CI both run tests under a consistent test environment. Documented that local uses .env.local/.env and CI uses workflow env. |
| **ci.yml** | Test steps "Run tests" and "Tenant isolation test" now have `env.NODE_ENV: test`. |
| **ci-agents.yml** | Same: `env.NODE_ENV: test` for the two test steps. |
| **ci-enterprise.yml** | Enterprise gate (pre-audit) step that runs test:run and test:tenant now has `env.NODE_ENV: test`. |

**Result:** Required env assumptions for tests (e.g. `lib/config/env` test defaults, `isTestEnv()` in scope) are consistent; test steps in CI use the same NODE_ENV as local Vitest runs. No new required env; setup files and mock config unchanged. Tests that need Supabase still fail clearly via rlsFixtures or skip via test.skipIf(!hasDb).
