# P0-1 — Employee smoke credentials and Production /week smoke evidence

**Status:** Evidence run · docs-only · **P0-1 NOT CLOSED**  
**Date:** 2026-06-30  
**Branch:** `audit/p0-1-employee-smoke-credentials`  
**Target:** `https://app.lunchportalen.no`  
**Operator:** Cursor agent (read-only + blocked authenticated smoke)

---

## 1. Scope

| In scope | Out of scope |
|----------|--------------|
| Credential availability check (names only) | Runtime code changes |
| Production flag read-only check | API / UI changes |
| Unauthenticated `/api/week` probe | DB / RLS changes |
| Blocked authenticated smoke (missing operator creds) | Production env value changes |
| Forbidden-field scan (when authenticated smoke blocked: N/A) | Feature flag activation |
| Golden Path recheck | G5d.8 · cutover · SoT switch · auto-rollout |

**No secret values are recorded in this document.**

---

## 2. Credentials status

| Check | Result |
|-------|--------|
| `E2E_EMPLOYEE_EMAIL` in GitHub Actions secrets | **yes** (name listed via `gh secret list`, 2026-05-31) |
| `E2E_EMPLOYEE_PASSWORD` in GitHub Actions secrets | **yes** (name listed via `gh secret list`, 2026-05-31) |
| `E2E_EMPLOYEE_EMAIL` in operator `.env.local` | **no** — MISSING |
| `E2E_EMPLOYEE_PASSWORD` in operator `.env.local` | **no** — MISSING |
| Stored securely (GitHub secrets) | **yes** (encrypted; values not readable from CLI) |
| Values printed in docs/logs/PR | **no** |
| Owner confirmed Production employee user for prod smoke | **no** — pending Thomas |
| Timestamp | 2026-06-30T23:17:14Z |

### Operator smoke result

```
AUTH_BLOCKED: E2E_EMPLOYEE_EMAIL/PASSWORD missing in operator env
```

Authenticated Production employee smoke **did not run**.

### Who must provide / where to store

| Item | Owner | Storage |
|------|-------|---------|
| Production employee smoke user (`E2E_EMPLOYEE_*`) | **Thomas (owner)** | GitHub Actions secrets (CI) **and** operator `.env.local` (gitignored) for manual Production smoke |
| Values | Owner only | Never in repo, docs, PR body, logs, or screenshots |

**Important:** GitHub `E2E_*` secrets are used by CI E2E against **staging Supabase (uigx)** per `docs/e2e/UIGX-RESEED-CHAIN.md`. Production smoke at `app.lunchportalen.no` requires a **Production** employee account with active agreement — confirm with owner that secret values map to Production auth, or provision dedicated prod smoke credentials.

### Provider admin not reused

| Check | Result |
|-------|--------|
| `E2E_PROVIDER_KITCHEN_EMAIL` in operator env | **no** — not configured locally |
| Employee creds distinct from provider kitchen | **not verified** (employee creds missing) |
| Provider admin used for employee `/api/week` proof | **no** — smoke blocked before login |

---

## 3. Production flag check (read-only)

**Method:** `vercel env ls production` (names only, 2026-06-30) + audit cross-check  
**Values not printed.**

| Flag | Production Vercel env |
|------|----------------------|
| `LP_MENU_PROFILE_RESOLVER` | **absent** |
| `LP_MENU_PROFILE_FIXED_CATEGORIES` | **absent** |
| `LP_MENU_PROFILE_WARM_DISH_PREVIEW` | **absent** |
| `LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL` | **absent** |
| `LP_MENU_PROFILE_MAPPING_DRAFT_API` | **absent** |
| `LP_MENU_PROFILE_PUBLISH_SHADOW` | **absent** |
| `LP_MENU_PROFILE_WEEK_SHADOW_READ` | **absent** |
| `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER` | **absent** |
| `LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK` | **absent** |
| `LP_MENU_PROFILE_EMPLOYEE_PROFILE_RUNTIME` | **absent / not implemented** |

**Result:** **PASS** — no `LP_MENU_PROFILE_*` entries in Production Vercel environment list.

**Note:** Preview environment has G5d flags for evidence-only work (expected). Production list had **zero** `LP_MENU_PROFILE_*` matches. This does not replace owner Production env sign-off (P0-3).

**Timestamp:** 2026-06-30T23:17Z

---

## 4. Employee login smoke

| Field | Value |
|-------|-------|
| Target URL | `https://app.lunchportalen.no` |
| Role expected | employee |
| Status | **NOT RUN** |
| Result | **BLOCKED** — missing operator `E2E_EMPLOYEE_*` |
| Timestamp | 2026-06-30T23:17:14Z |
| RID / session marker | N/A (no session) |
| Secret values | not recorded |

---

## 5. `/api/week` smoke (authenticated)

| Field | Value |
|-------|-------|
| Route | `GET /api/week?weekOffset=0` |
| Status | **NOT RUN** (authenticated) |
| RID | N/A |
| Days count | N/A |
| Response shape | N/A |
| Normalized hash | N/A |
| Forbidden field scan | **N/A** — blocked |
| Result | **FAIL (blocked)** |

### Unauthenticated control (expected fail-closed)

| Field | Value |
|-------|-------|
| Route | `GET /api/week?weekOffset=0` (no session) |
| HTTP status | **401** |
| `ok` | false |
| RID | `mw_mr19nyx8_nod77rnl` |
| Message | `Ikke innlogget.` |
| Result | **PASS** (expected unauthorized) |

---

## 6. Employee `/week` page smoke

| Field | Value |
|-------|-------|
| Route | `/week` |
| Status | **NOT RUN** |
| Visible result | N/A |
| Forbidden visible data | N/A |
| Result | **BLOCKED** |

---

## 7. Forbidden field scan

Authenticated response scan: **N/A (blocked)**.

| Field | Scan result |
|-------|-------------|
| providerId | N/A |
| compatibilityDecision | N/A |
| opsLog | N/A |
| pricePreview | N/A |
| provider_price_rules | N/A |
| commission / provisjon / vat / mva | N/A |
| candidateOrderable / orderableCandidate | N/A |
| sourceOfTruthChanged | N/A |
| autoRollout | N/A |

**Required for P0-1 close:** all **PASS** on authenticated Production `/api/week` JSON — not achieved.

---

## 8. Golden Path

| Field | Value |
|-------|-------|
| Command | `npm run test:golden-path` |
| Result | **91/91 PASS** |
| Expected | 91/91 PASS |
| Timestamp | 2026-06-30 (local gate run on branch) |

Also run (local):

| Command | Result |
|---------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run ci:commercial-hardcodes-guard` | PASS |

---

## 9. Conclusion

| Field | Value |
|-------|-------|
| **P0-1 status** | **NOT CLOSED** |
| **Launch decision** | Remains **CONDITIONAL GO** (not full GO) |

### Why NOT CLOSED

1. Operator environment lacks `E2E_EMPLOYEE_EMAIL` / `E2E_EMPLOYEE_PASSWORD` — authenticated Production smoke blocked.  
2. Employee login, authenticated `/api/week`, `/week` page, and forbidden-field scan **not executed**.  
3. Owner has not confirmed Production employee smoke user is provisioned and loaded for operator runs.  
4. GitHub secret **names** exist, but Production authenticated proof was not obtained in this run.

### What passed

- Production `LP_MENU_PROFILE_*` absent in Vercel Production env list (read-only).  
- Unauthenticated `/api/week` returns **401** (fail-closed).  
- Golden Path **91/91 PASS**.  
- No provider admin credentials used for employee proof.

### Remaining issues (P0)

| ID | Status |
|----|--------|
| P0-1 | **OPEN** — this document |
| P0-2 | OPEN — manual smoke not archived |
| P0-3 | OPEN — Production env owner sign-off |
| P0-4 | OPEN — on-call not named |
| P0-5 | OPEN — cross-tenant negative test |

### Next step (owner)

1. Add **Production** employee `E2E_EMPLOYEE_EMAIL` / `E2E_EMPLOYEE_PASSWORD` to operator `.env.local` (gitignored) — values from owner only.  
2. Confirm user is **employee** role with active agreement on Production.  
3. Re-run operator smoke (local script `scripts/temp-p0-1-prod-employee-smoke.mjs`, do not commit).  
4. If all checks PASS, update this doc to **CLOSED** and mark P0-1 in launch audit with evidence link.  
5. Do **not** use provider admin for employee `/api/week` proof.

---

*Evidence only. No runtime changes. No secrets in this file.*
