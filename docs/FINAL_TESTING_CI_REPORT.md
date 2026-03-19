# FINAL TESTING / CI REPORT

**Date:** 2025-03-14  
**Scope:** Testing and CI layer only. Read-only re-audit.  
**Rule:** Report ≥100% only if fully justified.

---

## 1. WHAT BLOCKED ≥100% BEFORE

(From discovery and hardening notes.)

| Blocker | Detail |
|--------|--------|
| **Lint not a hard gate** | `ci.yml` and `ci-enterprise.yml` used `lint:ci` (exit 0 on failure). PRs could merge with lint failures. |
| **sanity:live not in CI** | AGENTS.md K11/C3 requires “sanity:live passes”. No workflow ran `npm run sanity:live`. |
| **test:db never in CI** | `test:db` (database-integrity) exists but was not invoked in any workflow. |
| **E2E used plain build** | `ci-e2e.yml` ran `npm run build`, not `build:enterprise`. |
| **E2E mobile not in CI** | Playwright defines `chromium` and `mobile`; CI ran only `--project=chromium`. |
| **Fail-fast weakened** | `preflight` / `ci:enterprise` used `lint:ci`, so lint did not fail the critical path. |
| **Test env mismatch** | `NODE_ENV` / `VITEST` not guaranteed in vitest config; CI test steps did not set `NODE_ENV=test`. |
| **Verification path unclear** | No single documented “reproducible locally” path matching CI. |
| **Flaky tests** | RLS fixtures orgnr collisions; middleware `nextUrl.clone()`; publishFlow mock return shape; cleanup guards. |
| **Critical coverage gaps** | Cron auth and outbox batch-size behaviour not covered by tests. |

---

## 2. WHAT IS NOW VERIFIED COMPLETE

### 2.1 Top-level verification scripts

- **Normalized:** `ci:critical` → `ci:enterprise` (single canonical path).  
- **preflight:** Uses `lint` (not `lint:ci`), and runs: ci:guard → agents:check → typecheck → test:run → test:tenant → lint → audit:api → audit:repo (no build; preflight is pre-build gate).  
- **ci:enterprise:** ci:guard → agents:check → typecheck → test:run → test:tenant → lint → build:enterprise.  
- **lint:ci** still exists in `package.json` but is **not** used in any workflow or in preflight/ci:enterprise.

**Verdict:** Scripts are normalized; single critical path is `ci:critical` / `ci:enterprise`.

### 2.2 CI workflows — clear and blocking

- **ci.yml:** typecheck → lint → test:run → test:tenant → verify secrets → build:enterprise. All steps blocking; no `continue-on-error`.  
- **ci-enterprise.yml:** Same logical order (guard, typecheck, tests, lint, build:enterprise) with PROOF/audit steps; all blocking.  
- **ci-agents.yml:** agents:check → typecheck → lint → test:run → test:tenant → build:enterprise; all blocking.  
- **ci-e2e.yml:** typecheck → lint → verify env → build:enterprise → Playwright (chromium only); all blocking.

**Verdict:** Four gate workflows are clear and blocking; no soft steps in the main path.

### 2.3 Critical gates fail fast

- All workflows use `run: npm run lint` (strict). No workflow uses `lint:ci`.  
- No workflow uses `continue-on-error: true`.  
- Concurrency: ci, ci-enterprise, ci-e2e use `cancel-in-progress: true`.  
- preflight and ci:enterprise both use `lint`; lint failure fails the pipeline.

**Verdict:** Critical gates fail fast; lint is a hard gate.

### 2.4 Build enforced

- All four gate workflows run `npm run build:enterprise` as a discrete step.  
- Comments in workflows state the build step is a required gate.  
- ci-e2e uses `build:enterprise` (no longer plain `build`).  
- No workflow uses plain `npm run build` for the main verification path.

**Verdict:** Build is enforced as `build:enterprise` everywhere.

### 2.5 Critical coverage gaps addressed

- **Cron auth:** `tests/lib/http/cronAuth.test.ts` added (e.g. requireCronAuth).  
- **Cron outbox:** `tests/api/cronOutboxAuth.test.ts` — OUTBOX_BATCH_SIZE clamp (e.g. 200) covered.

**Verdict:** Previously identified critical coverage gaps are closed in code.

### 2.6 Flaky tests stabilized

- **rlsFixtures:** orgnr made per-build via `orgnrBaseFromRid(rid)`; `insertCompany` requires explicit orgnr; `insertLocation` retry without `label` on schema error; `afterEach`/`afterAll` use `if (fx?.cleanup) await fx.cleanup()`.  
- **Middleware:** `nextUrl.clone()` returns a real `URL` in test; second test mocks `getSupabasePublicConfig` to throw.  
- **publishFlow:** mock `insert()` returns `Promise.resolve({ data: { id }, error: null })`.

**Verdict:** Documented flaky areas have been stabilized.

### 2.7 Local and CI environments aligned

- **vitest.config.ts:** Sets `NODE_ENV = "test"` and `VITEST = "true"` when unset; documents local (.env.local/.env) vs CI (workflow env).  
- **ci.yml, ci-agents.yml, ci-enterprise.yml:** Test steps set `env.NODE_ENV: test`.

**Verdict:** Test environment is aligned between local and CI.

### 2.8 Testing/CI proof reproducible

- **ci.yml** header: “Verification path (reproducible locally): npm run ci:critical” and “Steps: ci:guard → typecheck → lint → test:run → test:tenant → build:enterprise”.  
- **ci-enterprise.yml** header: “Verification path: npm run ci:critical” and “This workflow adds PROOF/audit logging”.  
- Running `npm run ci:critical` locally runs the same logical sequence as the main CI path (with secrets/env required).

**Verdict:** Proof is reproducible via `npm run ci:critical`.

---

## 3. REMAINING VERIFIED GAPS

(Strict interpretation; no code changed in this audit.)

| Gap | Detail | Impact |
|-----|--------|--------|
| **sanity:live not in CI** | AGENTS.md K11 and C3 state that a change is DONE only when “sanity:live passes”. No workflow runs `npm run sanity:live`. Script exists (`scripts/sanity-live.mjs`). | By AGENTS.md, the official “required” gate set is not fully enforced in CI. |
| **test:db not in CI** | `npm run test:db` (database-integrity) exists and is documented; it is not invoked in any workflow. | DB integrity is not part of the automated gate. |
| **E2E mobile project not in CI** | Playwright config defines `chromium` and `mobile` (iPhone 14); ci-e2e runs only `--project=chromium`. | Mobile viewport E2E is not part of the CI gate (S1.1/S1.2 mobile rules not verified by E2E in CI). |
| **ci-agents build env** | ci-agents “Build enterprise” step passes only `NEXT_PUBLIC_SANITY_*` and `SANITY_API_TOKEN` (via job env). It does **not** set `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or `SYSTEM_MOTOR_SECRET` in the workflow file. | Build in ci-agents depends on repo/org secrets being set elsewhere; workflow is not self-describing for the same env as ci.yml/ci-enterprise. |

---

## 4. FINAL TESTING / CI MATURITY %

**Assessment:**

- **Normalization, fail-fast, build gate, critical coverage, stability, test env, reproducibility:** All verified complete for the current design.  
- **AGENTS.md alignment:** sanity:live is a stated requirement but not run in CI; test:db and E2E mobile are optional in the doc but represent known, documented capabilities not gated in CI; ci-agents build step env is incomplete in the file.

**Strict criterion:** Maturity at “≥100%” would require:

1. All AGENTS.md-required gates (including sanity:live) to be enforced in CI, or AGENTS.md to be updated to reflect that sanity:live is a manual/post-deploy gate.  
2. No remaining verified gaps that affect “required” or “critical” claims.

Because **sanity:live is required by AGENTS.md and is not in CI**, and because **test:db** and **E2E mobile** are present in the codebase but not in the gate, the Testing/CI layer is **not** rated at 100% in this audit.

**Final Testing / CI maturity: 92%**

- **92%:** Lint strict, build:enterprise everywhere, typecheck + test:run + test:tenant in all gates, fail-fast, env alignment, reproducible path, critical coverage and flaky fixes in place.  
- **−8%:** sanity:live not in CI (−4%), test:db not in CI (−2%), E2E mobile not in CI (−1%), ci-agents build env not fully specified in workflow (−1%).

**Conclusion:** Do **not** report ≥100% until sanity:live is either added to a CI workflow or explicitly scoped out of “required” in AGENTS.md, and until the other gaps above are either closed or explicitly accepted as non-gate.

---

*End of report. Read-only audit; no code modified.*
