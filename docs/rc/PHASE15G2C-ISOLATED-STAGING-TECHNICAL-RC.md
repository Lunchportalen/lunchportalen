# PHASE 15G.2C — ISOLATED STAGING AND TECHNICAL RC CERTIFICATE

**Issued:** 2026-07-16  
**Branch:** `release/global-21-country-tax-legal`  
**PR:** [#491](https://github.com/Lunchportalen/lunchportalen/pull/491)

---

## Repository

| Field | Value |
|-------|-------|
| Head before merge | `53ba137c16168b790eac76adc7f878baf3a1040e` |
| Prior staging app SHA | `152fa4a1996c8a520fcde751ba3c4574dc634251` |
| Migration head (branch + staging) | `20260831120000` |
| Production app SHA | `98b3b15e258966dd61ad967af5876982bcfcb959` |
| Production migration head | `20260818120000` |
| Production changed | **NO** |

---

## Full CI (separate lanes)

| Lane | Result | Evidence |
|------|--------|----------|
| Typecheck | PASS | local `docs/rc/evidence/15g2c-typecheck.log` |
| Lint | PASS (warnings only) | `15g2c-lint.log` |
| Production build | PASS (preflight) | push preflight on `53ba137c` |
| Enterprise | PASS | GH `29494780360` / re-run on new SHA |
| Full Vitest | PASS (parked live uigx smoke) | preflight: 5974+ unit; kitchen-batch smoke skipped when DATABASE_URL not uigx |
| RLS | PASS 5/5 | `15g2c-rls.log` |
| Golden Path package | PASS 103 | `15g2c-golden-path.log` |
| 21-country registry | PASS | `15g2c-21-country-registry.log` |
| 15-language | PASS | `15g2c-15-language.log` |
| 24-locale rendering | PASS | `15g2c-24-locale.log` |
| Tax/US/CA/billing suites | PASS 100 | `15g2c-focused-suites.log` |
| Staging golden matrix | PASS 21/21 + 24/24 | `15g2c-staging-golden-matrix.log` |
| Week Visual | PASS | GH CI |
| Provider Meny Visual | PASS | GH CI |
| Protected-path guard | PASS via PR body marker + label `protected-path-approved` | PR #491 |

---

## Staging tenants (RC15G2C)

Runtime seed via `npm run test:21-country-rc-proof` (cleanup in `afterAll`):

| Metric | Count |
|--------|------:|
| Countries seeded | 21 |
| Providers (unique) | 21 |
| Companies (unique) | 21 |
| Employees (JWT) | 21 |
| Provider admins (JWT) | 21 |
| Kitchens (JWT) | 21 |
| Company admins (auth) | 21 |
| Drivers (auth inventory) | 21 |
| Real recipients used | **0** (`@test.lunchportalen.no` sink only) |
| Real invoice series used | **0** (test RPC series only) |

Marker: `RC15G2C` / run correlation id in company/provider names.

---

## Runtime Golden Path

| Metric | Result |
|--------|--------|
| Countries passed | **21/21** |
| Tests | 23/23 PASS (`15g2c-21-country-rc-proof.log`) |
| Locales registered | 24/24 |
| Wrong-provider | 0 |
| Cross-tenant | 0 (incl. NO kitchen ≠ DE order advance) |
| Stripe calls | 0 |

---

## Rollback / reactivation

| Field | Value |
|-------|-------|
| Previous deployment | `dpl_GkrHfRfaC4srt6TNZjSSjNETXb4m` |
| Previous URL | `https://lunchportalen-gw3lfab8a-lunchportalen.vercel.app` |
| Previous SHA | `4dbb09ccd85f0671dd7448d8adf7413ac882555b` |
| Rollback start | `2026-07-16T13:04:53.793Z` |
| Rollback complete | `2026-07-16T13:05:08.621Z` |
| Rollback RTO | **~15 s** |
| Reactivation start | `2026-07-16T13:05:52.508Z` |
| Reactivation complete | `2026-07-16T13:06:05.398Z` |
| Reactivation RTO | **~13 s** |
| Reactivated SHA | `152fa4a1996c8a520fcde751ba3c4574dc634251` |
| Health probes | **10/10** over ≥5 min |
| Data loss / RPO | **0** (alias-only; DB unchanged) |

Method: Vercel `POST /v2/deployments/{id}/aliases` (project-scoped). Production domains hard-blocked.

---

## External approvals

All remain **0/21** (or N/A where documented). Fixture/RESEARCHED ≠ legal approval.

---

## Decision

- `TECHNICAL_21_COMPLETE` = **YES** (pending merge freeze of `TECHNICAL_GLOBAL_RC_SHA`)
- `AWAITING_EXTERNAL_APPROVAL` = **YES**
- `GLOBAL_21_READY` = **NO**
- Exact next prompt permitted: **PHASE 15G.3 — EXTERNAL APPROVAL INGESTION AND FINAL GLOBAL RELEASE CERTIFICATION** = **YES**
