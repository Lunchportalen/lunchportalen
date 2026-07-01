# P0-1 — Employee smoke credentials and Production /week smoke evidence

**Status:** Evidence run · docs-only · **P0-1 CLOSED**  
**Date:** 2026-06-30 (re-run with operator credentials)  
**Branch:** `audit/p0-1-employee-smoke-credentials`  
**Target:** `https://app.lunchportalen.no`  
**Operator:** Cursor agent (local smoke; no runtime changes)

---

## 1. Scope

| In scope | Out of scope |
|----------|--------------|
| Credential availability (names / masked email only) | Runtime code changes |
| Production flag read-only check | API / UI changes |
| Unauthenticated + authenticated `/api/week` smoke | DB / RLS changes |
| Employee `/week` page smoke | Production env value changes |
| Forbidden-field scan | Feature flag activation |
| Golden Path + governance gates | G5d.8 · cutover · SoT switch · auto-rollout |

**No secret values are recorded in this document.**

---

## 2. Credentials status

| Check | Result |
|-------|--------|
| `E2E_EMPLOYEE_EMAIL` in GitHub Actions secrets | **yes** (name listed via `gh secret list`) |
| `E2E_EMPLOYEE_PASSWORD` in GitHub Actions secrets | **yes** (name listed via `gh secret list`) |
| `E2E_EMPLOYEE_EMAIL` in operator `.env.local` | **yes** — SET (len=21) |
| `E2E_EMPLOYEE_PASSWORD` in operator `.env.local` | **yes** — SET (len=10) |
| Stored securely (gitignored `.env.local`) | **yes** — `.env.local` in `.gitignore`, not staged |
| Values printed in docs/logs/PR | **no** |
| Masked employee email (Production smoke user) | `t***@pettersenco.no` |
| Email hash (SHA-256 prefix) | `62f34cb467a4` |
| Owner confirmed Production employee user | **yes** — Thomas (operator `.env.local`, 2026-06-30) |
| Timestamp | 2026-06-30T23:47:43Z |

### Provider admin not reused

| Check | Result |
|-------|--------|
| `E2E_PROVIDER_KITCHEN_EMAIL` in operator env | **no** — not configured |
| Provider admin used for employee `/api/week` proof | **no** |
| Employee creds used exclusively for smoke | **yes** |

---

## 3. Production flag check (read-only)

**Method:** `vercel env ls production` (names only)  
**Values not printed.**

| Flag | Production Vercel env |
|------|----------------------|
| All `LP_MENU_PROFILE_*` (10 flags) | **absent** |
| `LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK` | **absent** |
| `LP_MENU_PROFILE_EMPLOYEE_PROFILE_RUNTIME` | **absent / not implemented** |

**Result:** **PASS** — zero `LP_MENU_PROFILE_*` entries in Production Vercel environment list.

**Timestamp:** 2026-06-30T23:46Z (re-run)

---

## 4. Employee login smoke

| Field | Value |
|-------|-------|
| Target URL | `https://app.lunchportalen.no/login?next=%2Fweek` |
| Role | employee (lands on `/week`) |
| Status | **PASS** |
| Landed path | `/week` |
| Timestamp | 2026-06-30T23:47:46Z |
| Session marker | email hash `62f34cb467a4` only |
| Secret values | not recorded |

---

## 5. `/api/week` smoke (authenticated)

| Field | Value |
|-------|-------|
| Route | `GET /api/week?weekOffset=0` |
| HTTP status | **200** |
| `ok` | **true** |
| RID | `week_api_mr1ar8vt_wictlr` |
| Top-level keys | `data`, `ok`, `rid` |
| Days count | **5** |
| Normalized response hash | `9b3e8fd0a5d04bd424cf9e50972fc7cb90d1f869676823b1a6d3afabf6a21376` |
| Forbidden field scan | **PASS** (zero hits) |
| Result | **PASS** |

### Unauthenticated control

| Field | Value |
|-------|-------|
| Route | `GET /api/week?weekOffset=0` (no session) |
| HTTP status | **401** |
| RID | `mw_mr1ar6ii_jldyg1v9` |
| Result | **PASS** (expected unauthorized) |

---

## 6. Employee `/week` page smoke

| Field | Value |
|-------|-------|
| Route | `/week` |
| Status | **PASS** |
| Forbidden visible fields | none |
| Commercial visible fields | none |
| Access denied text | none |
| Screenshot | `test-results/p0-1-prod-week-redacted.png` (local only, not committed) |
| Result | **PASS** |

---

## 7. Forbidden field scan

Authenticated `/api/week` JSON — all **PASS**:

| Field | Result |
|-------|--------|
| providerId | PASS |
| providerInternal | PASS |
| compatibilityDecision / compatibilityCutover | PASS |
| weekRuntimeCompatibilityDecision | PASS |
| opsLog | PASS |
| pricePreview | PASS |
| provider_price_rules | PASS |
| commission / provisjon / vat / mva | PASS |
| commercialVisibleChanges / priceVisibleChanges | PASS |
| candidateOrderable / orderableCandidate | PASS |
| sourceOfTruthChanged / sourceOfTruthSwitch | PASS |
| autoRollout | PASS |
| runtimeHookActive | PASS |

---

## 8. Golden Path and gates

| Command | Result | Timestamp |
|---------|--------|-----------|
| `npm run test:golden-path` | **91/91 PASS** | 2026-06-30 |
| `npm run typecheck` | PASS | 2026-06-30 |
| `npm run lint` | PASS | 2026-06-30 |
| `npm run ci:commercial-hardcodes-guard` | PASS | 2026-06-30 |
| `live-readiness-launch-audit-contracts.test.ts` | **18/18 PASS** | 2026-06-30 |

---

## 9. Conclusion

| Field | Value |
|-------|-------|
| **P0-1 status** | **CLOSED** |
| **Launch decision** | Remains **CONDITIONAL GO** (P0-2..P0-5 still open) |

### Closed because

1. Operator `E2E_EMPLOYEE_*` present in gitignored `.env.local`.  
2. Production employee login → `/week` **PASS**.  
3. Authenticated `GET /api/week?weekOffset=0` → **200**, 5 days, forbidden scan **PASS**.  
4. Employee `/week` page **PASS** — no commercial/provider leakage visible.  
5. Production `LP_MENU_PROFILE_*` absent in Vercel Production env list.  
6. Golden Path **91/91 PASS**.  
7. No runtime changes · no Production env values exposed · no flag activation.

### Remaining P0 (not in scope for P0-1)

| ID | Status |
|----|--------|
| P0-2 | OPEN — full manual smoke §9 not archived |
| P0-3 | OPEN — Production env owner sign-off |
| P0-4 | OPEN — on-call not named |
| P0-5 | OPEN — cross-tenant negative test |

### Next P0

**P0-2** — Execute and archive full Production manual smoke checklist (§9 in launch audit).

---

*Evidence only. No runtime changes. No secrets in this file.*
