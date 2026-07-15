# PHASE 14C.2 — FINAL STAGING RUNTIME CERTIFICATION

**Issued:** 2026-07-15  
**Decision:** **NO-GO** (runtime gates partially closed; certification incomplete)  
**PHASE 14D permitted:** **NO**

---

## Release

| Field | Value |
|-------|-------|
| Previous RC SHA | `5cf96d7457292976faac4a6decc8763baf0aa48f` |
| Final PR head SHA | `a51fdc7b08440eb44d0625d7c5cd77c829512b16` |
| staging runtime SHA | `a51fdc7b08440eb44d0625d7c5cd77c829512b16` |
| health SHA | `a51fdc7b08440eb44d0625d7c5cd77c829512b16` |
| Exact match | **YES** |
| Migrations | 83/83 (live staging `uigxsboqeruxflgzqztl`) |
| Manifest | `docs/rc/phase13-release-manifest.md` @ `a51fdc7b` |
| Checksums | Regenerated in RC commit |

---

## Vercel incident

| Field | Value |
|-------|-------|
| Production targeted | Yes (accidental `vercel promote`, Phase 14C.1) |
| Production changed | **NO** |
| Production alias changed | **NO** |
| Production deployment changed | **NO** |
| Root cause | `vercel promote` targets Production, not staging |
| Preventive control | Incident matrix doc; ban `vercel promote`; require `--target=staging` + `-e APP_VERSION=<sha>` |

See: `docs/rc/PHASE14C2-VERCEL-INCIDENT-AND-TARGET-MATRIX.md`

---

## Staging

| Field | Value |
|-------|-------|
| Domain | `staging.app.lunchportalen.no` |
| Deployment | `dpl_FxTvE4GNnujyGfSTox3Hx1pjsX8D` (`lunchportalen-h3587y56u`) |
| Previous deployment | `dpl_FvnXdRKhpSYJ6R5XRymZG2aKAmaj` |
| Stable health probes (Node fetch) | **FAIL** — redirect loop without bypass; **PASS** with bypass (curl/node detail probe) |
| Supabase | `uigxsboqeruxflgzqztl` OK |
| Sanity | staging OK |
| Invoice-only | active (inherited) |
| Stripe dependency | 0 |

---

## Code remediations (this RC)

| Gate | Change | Result |
|------|--------|--------|
| 2 | `lib/version/releaseIdentity.ts` + health fail-closed | **PASS** — no `unknown` when `APP_VERSION` set |
| 4 | Cron routes already use `requireCronAuth`; smoke uses bypass | Spot cron on staging pending stable run |
| 5 | k6 Oslo date fix, read-only smoke, bypass priming, kitchen 403 guard | **PARTIAL** — intermittent session 401 on week/day |
| 6 | `db-rebuild-verify.mjs` EXPECTED-RED CMS tables removed | **PASS** local empty rebuild |
| 7 | `.github/workflows/ci-e2e-staging-runtime.yml` + preflight script | **NOT RUN** (await dispatch) |

---

## Cron security

| Field | Value |
|-------|-------|
| Routes tested (unit) | invoice generate + inventory scan |
| Unauthorized successes (unit) | 0 |
| Live staging spot | Not completed this session |
| Result | **PARTIAL** |

---

## k6

| Field | Value |
|-------|-------|
| Login | PASS (when staging stable) |
| Week / Daily | **INTERMITTENT** — 401 session loss on protected staging |
| Kitchen | Role guard (403) expected for employee |
| Health | PASS |
| Thresholds | **FAIL** (auth flakiness on read paths) |
| Result | **FAIL** |

---

## Rebuild

| Field | Value |
|-------|-------|
| Target | Local Supabase empty reset |
| Migrations | 83/83 |
| False CMS expectations removed | 16 |
| Schema verification | **PASS** |
| Destroyed | Yes |

---

## Playwright / language / commercial / cron battery

| Gate | Status |
|------|--------|
| Linux Playwright vs staging.app | **NOT RUN** |
| 15-language browser matrix | **NOT RUN** |
| 24-locale browser matrix | **NOT RUN** |
| Dedicated cron/outbox battery | **NOT RUN** |
| Full commercial browser chain | **NOT RUN** |

Prior RC CI Linux E2E @ `5cf96d74` (localhost) remains green; does not satisfy Gate 7 staging-runtime requirement.

---

## Integrity / rollback / approvals

| Area | Status |
|------|--------|
| Tenant crossing (inherited 14C proof) | 0 |
| Rollback deployment documented | YES |
| APPROVED_COUNTRY_ALLOWLIST | NO only |
| FULL_21_COUNTRY_ACTIVATION_READY | NO |

---

## Safety

| Check | Status |
|-------|--------|
| Production changed | NO |
| Production migrated | NO |
| PR merged | NO |
| Umbraco / Azure / lunchportalen.no | Untouched |
| Stripe activated | NO |

---

## Decision

### TECHNICAL_GO_FOR_MERGE: **NO-GO**

### PHASE 14D — MERGE RC AND FINAL PRODUCTION PREFLIGHT: **NO**

---

## Remaining actions

1. Dispatch `CI E2E Staging Runtime` @ `a51fdc7b` after secrets wired.
2. Stabilize k6 session on `staging.app` (cookie + bypass) — verify 3 consecutive green smokes.
3. Run cron/outbox battery with `LP_SMOKE_CRON_SECRET` + bypass on staging.
4. Execute 15-language / 24-locale browser matrix on staging.
5. Full commercial browser chain on staging.

---

*No merge. No production deploy. No production migration.*
