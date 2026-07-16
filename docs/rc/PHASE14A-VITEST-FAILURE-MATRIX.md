# PHASE 14A — Vitest failure matrix

**Baseline run:** `RUN_SUPABASE_INTEGRATION_TESTS=0` · `RC_MODE=true` · HEAD `f538d903` (pre-fix)  
**Recorded:** 2026-07-14 · `.backups/phase14a-vitest-results.json`

| Metric | Count |
|--------|------:|
| Failed files | 64 |
| Failed tests | 105 |
| Passed tests | 5771 |
| Skipped tests | 290 |

## Root-cause summary

| Failure type | Tests | Classification | Fix |
|--------------|------:|----------------|-----|
| `act is not a function` (React 19 + Vitest jsdom) | 99 | TEST_HARNESS_DEFECT | `tests/_helpers/reactAct.ts` + setup + import migration |
| `NODE_ENV=production` leaked from `.env.local` | 3 | ENVIRONMENT_LEAK | Lock `NODE_ENV=test` after dotenv in `vitest.config.ts` |
| `No such built-in module: node:` in jsdom | 3 | TEST_HARNESS_DEFECT | Split fs contract tests to node file; use `fs`/`path` in jsdom suites |
| Governance scan hit `.backups/` vitest JSON artifacts | 2 | TEST_HARNESS_DEFECT | Exclude artifact dirs in `walkFiles` |

## Detailed matrix (pre-fix)

| Test file | Domain | Failure type | Product regression | Fix required | Owner |
|-----------|--------|--------------|-------------------|--------------|-------|
| tests/ai/CmsAiHappyPath.test.tsx | CMS AI | TIMING/ACT_DEFECT | No | reactAct helper | release |
| tests/ai/CmsAiSeamlessBlockFlow.test.ts | CMS AI | TIMING/ACT_DEFECT | No | reactAct helper | release |
| tests/auth/*.test.tsx (8 files) | Auth | TIMING/ACT_DEFECT | No | reactAct helper | release |
| tests/backoffice/*.test.tsx (2 files) | Backoffice | TIMING/ACT_DEFECT | No | reactAct helper | release |
| tests/components/*.test.tsx (9 files) | UI | TIMING/ACT_DEFECT | No | reactAct helper + fs import | release |
| tests/cms/*.test.ts(x) (4 files) | CMS | TIMING/ACT_DEFECT / TEST_HARNESS | No | reactAct + split deps test | release |
| tests/runtime/*.test.tsx (4 files) | Runtime | TIMING/ACT_DEFECT | No | reactAct helper | release |
| tests/e2e/tripletex-onboarding-happy-path.test.tsx | Tripletex | TIMING/ACT_DEFECT | No | reactAct helper | release |
| tests/app/superadmin/*/C*Client.moneyDisplay.test.tsx | Superadmin | TIMING/ACT_DEFECT | No | reactAct helper | release |
| tests/auth/localDevBypassCookie.test.ts | Auth | ENVIRONMENT_LEAK | No | NODE_ENV=test lock | release |
| tests/middleware/middlewareRedirectSafety.test.ts | Middleware | ENVIRONMENT_LEAK | No | NODE_ENV=test lock | release |
| tests/lib/cms/menuDayProviderFilter.test.ts | CMS | ENVIRONMENT_LEAK | No | NODE_ENV=test lock | release |
| tests/components/WeekAllergenProfileCard.test.tsx | Allergen UI | TEST_HARNESS_DEFECT | No | fs/path imports in jsdom | release |
| tests/components/provider-menu/providerMenuRuntimeMappingDraftSaveUi.test.tsx | Provider menu | TEST_HARNESS_DEFECT | No | fs/path imports in jsdom | release |
| tests/cms/contentWorkspaceStability.smoke.test.ts | CMS workspace | TEST_HARNESS_DEFECT | No | Move fs reads to node test file | release |
| tests/governance/g5d7a-runtime-hook-governance-contracts.test.ts | Governance | TEST_HARNESS_DEFECT | No | Exclude `.backups/` from repo walk | release |

## Post-fix verification

| Run | Failed files | Failed tests | Passed | Skipped |
|-----|-------------:|-------------:|-------:|--------:|
| Full suite run 1 | 0 | 0 | 5899 | 290 |
| Full suite run 2 | 0 | 0 | 5899 | 290 |

**UNKNOWN remaining:** 0
