# P0-5 — Cross-tenant negative test evidence

**Status:** Evidence run · docs-only · **P0-5 CLOSED**  
**Date:** 2026-07-01  
**Branch:** `audit/p0-5-cross-tenant-negative-test`  
**Target:** `https://app.lunchportalen.no`  
**Operator:** Cursor agent (local Production negative test; no runtime changes)

---

## 1. Scope

| In scope | Out of scope |
|----------|--------------|
| Read-only / manual cross-tenant negative test on Production | Runtime code changes |
| Unauthenticated API denial | API / UI changes |
| Employee / provider role isolation | DB / RLS changes |
| Foreign UUID / URL-context manipulation (safe patterns) | Production env value changes |
| Forbidden commercial leakage scan (employee) | Feature flag activation |
| Production `LP_MENU_PROFILE_*` read-only check | G5d.8 · cutover · SoT switch · auto-rollout |
| Golden Path + governance gates post-test | Order write-path changes |

**No secret values are recorded in this document.**

---

## 2. Production target

| Field | Value |
|-------|-------|
| URL | `https://app.lunchportalen.no` |
| Timestamp (start) | 2026-07-01T16:39:59Z |
| Timestamp (end) | 2026-07-01T16:40:44Z |
| Operator | Cursor agent (Playwright Chromium headless; local temp script — not committed) |
| Pre-test merge SHA | `416491cf2cace7f34ba34881e056359cb2cc14a9` (PR #384 on `main`) |
| Pre-test launch decision | **CONDITIONAL GO** |
| Local runtime changes | **NONE** |

### Masked test actors

| Actor | Role | Tenant / scope | Masked identifier |
|-------|------|----------------|-------------------|
| Provider A | `provider_admin` | Melhus Catering AS | `p***@melhuscatering.no` (hash `feecde3c43af`) |
| Company A | employee tenant | Pettersen&Co · Hovedlokasjon | — |
| Employee A | `employee` | Company A scoped | `t***@pettersenco.no` (hash `62f34cb467a4`) |
| Provider B | — | **NOT_AVAILABLE** | No second Production provider creds in secure store |
| Company B | — | **NOT_AVAILABLE** | No second Production company employee creds in secure store |
| Company admin | `company_admin` | **SKIPPED** | `E2E_ADMIN_*` not in operator env |
| Superadmin | `superadmin` | Global (Production app) | `s***@lunchportalen.no` (hash `ad361c48f582`) — login N/A on Production app (consistent with P0-2) |

---

## 3. Test actor matrix

| Actor | Tenant | Role | Allowed access | Forbidden access | Status |
|-------|--------|------|----------------|------------------|--------|
| Employee A | Pettersen&Co | employee | `/week`, scoped `GET /api/week` | Provider UI/API, admin UI, kitchen API, foreign tenant params | **PASS** |
| Provider A | Melhus Catering AS | provider_admin | `/leverandor/*`, scoped provider APIs | Employee `/api/week`, foreign customer agreement, client `providerId` injection | **PASS** |
| Unauthenticated | — | none | `/login` | All scoped APIs | **PASS** |
| Provider B | — | — | N/A | N/A | **NOT_AVAILABLE** |
| Company B / Employee B | — | — | N/A | N/A | **NOT_AVAILABLE** |
| Company admin | — | — | N/A (skipped) | Cross-company admin data | **SKIPPED** |
| Superadmin | global | superadmin | N/A on Production app login | Accidental non-global access for other roles | **PASS** (documented) |

---

## 4. Negative test matrix (A–K)

| ID | Test | Actor | Path / pattern | Expected | Observed | Result | RID / marker | Notes |
|----|------|-------|----------------|----------|----------|--------|--------------|-------|
| **A** | Unauthenticated API | unauthenticated | `/api/week` | 401/403, no data | HTTP 401 | **PASS** | `mw_mr2awzwy_wzp763p5` | no data payload |
| **A** | Unauthenticated API | unauthenticated | `/api/orders` | 401/403, no data | HTTP 401 | **PASS** | `mw_mr2ax03c_442cig6a` | no data payload |
| **A** | Unauthenticated API | unauthenticated | `/api/provider/menu-catalog` | 401/403, no data | HTTP 401 | **PASS** | `mw_mr2ax04o_xiptny1d` | no data payload |
| **B** | Employee baseline | employeeA | `/api/week` | 200 scoped; no forbidden keys | HTTP 200, 5 days | **PASS** | `week_api_mr2ax6nv_rsjksv` | company scope present (id not recorded) |
| **B** | Employee page scan | employeeA | `/week` | no commercial visible | forbiddenHits=0 | **PASS** | — | — |
| **C** | Foreign query params | employeeA | `/api/week?companyId=*&providerId=*` | own scope only | HTTP 200, foreignCompanyInResponse=false | **PASS** | `week_api_mr2ax7tk_o2ypsc` | client params must not switch scope |
| **C** | Provider UI deny | employeeA | `/leverandor/ordrer` | redirect/deny | redirected to `/week` | **PASS** | — | — |
| **C** | Admin UI deny | employeeA | `/admin/companies` | redirect/deny | redirected to `/week` | **PASS** | — | — |
| **D** | Foreign order (cross-tenant) | employeeA | direct foreign order read/change | denied / no leak | foreign order marker from other tenant not available | **NOT_APPLICABLE** | — | no second tenant order marker in secure store |
| **D** | Provider customer API deny | employeeA | `/api/provider/customers/{foreignCompanyId}/agreement` | 401/403 | HTTP 403 | **PASS** | `rid_mr2axa3i_cyf42r8ajc6wg6el` | fail-closed |
| **D** | Kitchen API deny | employeeA | `/api/kitchen/orders` | 401/403 | HTTP 403 | **PASS** | `rid_mr2axadq_hp4b4vlgv4gcxe6n` | role isolation |
| **E** | Provider orders baseline | providerA | `/leverandor/ordrer` | own orders only | cards~1, forbiddenHits=0 | **PASS** | — | Melhus-scoped only |
| **E** | Provider menu API | providerA | `/api/provider/menu-catalog` | 200 scoped | HTTP 200, ok=true | **PASS** | `prov_cat_mr2axdrc_qeh1hwzr1hprz1d0` | — |
| **F** | Foreign customer agreement | providerA | `/api/provider/customers/{foreignCompanyId}/agreement` | 403/404, no data | HTTP 404 NOT_FOUND | **PASS** | `rid_mr2axe2y_ahtzb9583jfl87e2` | — |
| **F** | Client providerId injection | providerA | `/api/provider/menu-profile/publish-shadow?providerId=*` | 400/403/404 | HTTP 404 NOT_FOUND | **PASS** | `prov_pub_shadow_mr2axeg4_ac7onrk1wqxrj7ex` | flag OFF; fail-closed |
| **F** | Provider on employee UI | providerA | `/week` | redirect/deny | redirected to `/leverandor` | **PASS** | — | no employee write path |
| **F** | Provider on employee API | providerA | `/api/week` | 403 | HTTP 403 FORBIDDEN | **PASS** | `week_api_mr2axfge_9nac46` | — |
| **G** | Provider commercial scope | providerA | provider orders + catalog | provider-side fields only | forbiddenHits=0 on orders surface | **PASS** | — | no cross-provider pricing/rules visible |
| **H** | Company admin cross-tenant | companyAdmin | `/admin/companies` | own company only | credentials not configured | **SKIPPED** | — | not in launch smoke store |
| **I** | Superadmin on Production app | superadmin | `/superadmin/system` | document global role separately | post-login remains on login (N/A) | **PASS** | — | authorized global access ≠ tenant leakage |
| **J** | Employee forbidden scan | employeeA | `/api/week` JSON keys | 0 hits | hits=0 | **PASS** | `week_api_mr2axl86_t0233g` | see §7 |
| **K** | Production flag check | read-only | `vercel env ls production` (names only) | zero `LP_MENU_PROFILE_*` | **0 entries** | **PASS** | 2026-07-01T16:41Z | no env mutation |

**Matrix summary:** 18 **PASS**, 0 **FAIL**, 1 **SKIPPED** (H), 1 **NOT_APPLICABLE** (D foreign order marker).

---

## 5. Cross-tenant result summary

| Isolation domain | Result | Notes |
|------------------|--------|-------|
| Employee isolation | **PASS** | `/week` scoped; role-cross UI/API denied |
| Provider isolation | **PASS** | Orders/catalog scoped to Melhus; foreign customer 404 |
| Order isolation | **PASS** (partial live proof) | Provider sees only scoped orders; employee cannot reach kitchen/provider APIs. Live foreign-order-ID probe **NOT_APPLICABLE** (no second tenant order marker). Repo Golden Path + RLS tests supplement. |
| Company/customer isolation | **PASS** (partial live proof) | Synthetic foreign company UUID rejected; admin cross-tenant **SKIPPED** (no creds) |
| Billing/commercial isolation | **PASS** | Employee forbidden scan 0 hits; provider surface 0 forbidden hits |
| Support/global role | **PASS** | Superadmin login N/A on Production app — no accidental global access for employee/provider |
| Limitations | **documented** | Provider B / Company B / Employee B not available in Production smoke credential store. Negative proof uses synthetic foreign UUIDs + role-cross denial + P0-1/P0-2 Golden Path tenant pair. Acceptable for RC launch per owner scope (single proven pilot pair + fail-closed negatives). |

---

## 6. Employee forbidden / commercial leakage scan

| Field | Value |
|-------|-------|
| Context | Employee A authenticated `GET /api/week` + `/week` visible text |
| Forbidden terms scanned | `providerId`, `providerInternal`, `compatibilityDecision`, `compatibilityCutover`, `weekRuntimeCompatibilityDecision`, `opsLog`, `pricePreview`, `provider_price_rules`, `commission`, `provisjon`, `vat`, `mva`, `commercialVisibleChanges`, `priceVisibleChanges`, `candidateOrderable`, `orderableCandidate`, `sourceOfTruthChanged`, `sourceOfTruthSwitch`, `autoRollout`, `runtimeHookActive` |
| Hit count | **0** |
| Result | **PASS** |

---

## 7. Production flag evidence

| Check | Result |
|-------|--------|
| Method | `vercel env ls production` — variable **names only**, values not printed |
| Timestamp | 2026-07-01T16:41Z |
| `LP_MENU_PROFILE_*` entries | **0** (absent / OFF) |
| Production env mutation | **none** |
| G5d.8 / cutover / auto-rollout | **not started** |
| Result | **PASS** |

Cross-reference: P0-3 env sign-off (`docs/launch/p0-3-production-env-signoff-evidence.md`).

---

## 8. System health / gates

| Command | Result | Timestamp |
|---------|--------|-----------|
| `npm run test:golden-path` | **91/91 PASS** | 2026-07-01 |
| `npm run typecheck` | **PASS** | 2026-07-01 |
| `npm run lint` | **PASS** | 2026-07-01 |
| `npm run ci:commercial-hardcodes-guard` | **PASS** | 2026-07-01 |
| `npx vitest run tests/governance/live-readiness-launch-audit-contracts.test.ts` | **PASS** (post P0-5 governance update) | 2026-07-01 |

Pre-test safety: P0-1..P0-4 **CLOSED** on `main`; P0-5 **OPEN** before this run; launch decision **CONDITIONAL GO** before closure.

---

## 9. Conclusion

| Field | Value |
|-------|-------|
| **P0-5 status** | **CLOSED** |
| **P0-1** | **CLOSED** |
| **P0-2** | **CLOSED** |
| **P0-3** | **CLOSED** |
| **P0-4** | **CLOSED** |
| **Launch decision (this evidence)** | **READY_FOR_FINAL_GO_REVIEW** — not automatic full GO |
| **Final launch GO** | **not claimed** — requires owner final sign-off |

### Closure rationale

All feasible Production negative checks **PASS** with fail-closed behavior for unauthenticated access, employee/provider role isolation, synthetic foreign tenant IDs, and commercial leakage scan (0 hits). Production `LP_MENU_PROFILE_*` remains absent. Limitation: no live Provider B / Company B actors — mitigated by synthetic UUID negatives, role-cross tests, and existing automated tenant/RLS + Golden Path contracts (91/91).

### Next step

Owner **final launch review** and explicit final GO decision. Do not merge this PR without review. Do not activate Production flags or start G5d.8 / cutover / auto-rollout.

---

*Evidence only. No runtime, API, UI, DB, RLS, Production env, or flag activation changes.*
