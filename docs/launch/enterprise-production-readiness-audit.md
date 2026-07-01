# Enterprise production readiness audit — Lunchportalen

**Status:** Read-only audit · docs-only · no runtime changes  
**Date:** 2026-06-30  
**Branch:** `audit/live-readiness-enterprise-launch`  
**Target launch window:** ~1 week (multi-provider / multi-company SaaS)  
**Explicitly out of scope:** G5d.8 · runtime cutover · source-of-truth switch · Production flag activation · auto-rollout · employee profile runtime

---

## Discovery summary (DEL 1 — read-only)

| Area | Current state |
|------|----------------|
| **Golden Path** | Protected chain documented in `docs/PROTECTED_GOLDEN_PATH.md`. Contract tests lock `/week` scope, `lp_order_set`, provider isolation, production status flow, cutoff GUC. G5d.7c merged: hook behind `LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK`, default OFF, fail-closed to current behavior. |
| **Production-critical endpoints** | `GET /api/week`, `POST /api/orders/set`, `GET/POST` provider menu publish, `app/leverandor/ordrer` + status advance, `POST /api/auth/post-login`, onboarding, agreement gates, cron/outbox (system motor). |
| **Auth roles** | `superadmin`, `company_admin`, `employee`, `kitchen`, `driver`, `provider_admin`, `provider_kitchen`, `provider_viewer` (`lib/auth/getAuthContext.ts`). Provider scope via `provider_memberships`; company scope via `profiles.company_id` + `location_id`. |
| **Scoping** | Fail-closed: company/location from server profile; provider menu scope via `resolveProviderMenuScopeForCompany`; kitchen orders filtered `.eq("provider_id")`; wrong provider cannot advance status. |
| **Order write path** | `POST /api/orders/set` → eligibility gates → published menu validation → `lp_order_set` via `lib/orders/rpcWrite.ts`. Idempotency covered in tests. |
| **Publish / menu flow** | Provider publishes menu → Sanity `menuDay` → materialization to `menu_service_days` / `menu_service_day_items` → employee `/week` reads scoped Sanity + MSDI fallback. |
| **Cutoff** | Europe/Oslo 08:00 (`lib/cutoff.ts`). Employee mutations blocked after cutoff; provider production advances via `lp_order_advance_status` GUC (not blocked by employee cutoff). |
| **Billing / provision** | Tripletex integration exists; hybrid/manual elements remain (see `docs/audit/tripletex-plan-v1.md`, `OPEN_PLATFORM_RISKS` C1–C2). **Launch scope:** provision basis readonly + manual first invoice QA — not automatic broad billing go-live. |
| **CI / guards** | `ci:enterprise` = typecheck + full vitest + tenant + lint + `build:enterprise`. Golden Path: `npm run test:golden-path`. Commercial hardcodes: `npm run ci:commercial-hardcodes-guard`. Protected path: `scripts/ci/guard-protected-golden-path.mjs`. |
| **Production flags** | All `LP_MENU_PROFILE_*` must be OFF/unset at launch (see §3). G5d.7c hook exists in code but is inert when flag OFF. |
| **Critical secrets** | `SYSTEM_MOTOR_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, Sanity read/write tokens as needed, `CRON_SECRET`, email provider keys, optional Tripletex keys if billing in scope. |
| **Smoke credentials gap** | ~~Missing locally~~ **P0-1 CLOSED** — see `docs/launch/p0-1-employee-smoke-evidence.md` (Production `/api/week` smoke PASS, 2026-06-30) |

---

## 1. Executive decision

| Field | Value |
|-------|-------|
| **Decision** | **CONDITIONAL GO** |
| **Launch date readiness** | Target ~1 week is **achievable** if P0 items below are closed before Production cutover. Code/contracts are RC-ready; operational proof is incomplete. |
| **Rationale** | Golden Path contract suite is green in repo gates. Protected path is locked. All menu-profile runtime flags are designed OFF-by-default. **P0-1 CLOSED** — `docs/launch/p0-1-employee-smoke-evidence.md`. **P0-2 CLOSED** — `docs/launch/p0-2-production-manual-smoke-evidence.md`. **P0-3 CLOSED** — `docs/launch/p0-3-production-env-signoff-evidence.md` (2026-07-01). Remaining blockers: on-call, cross-tenant proof. |

### Top 5 launch blockers (P0)

1. ~~**No verified employee smoke credentials**~~ **CLOSED (P0-1)** — `docs/launch/p0-1-employee-smoke-evidence.md`
2. ~~**Pre-launch manual smoke not executed**~~ **CLOSED (P0-2)** — `docs/launch/p0-2-production-manual-smoke-evidence.md`
3. ~~**Production env secrets checklist** not signed off~~ **CLOSED (P0-3)** — `docs/launch/p0-3-production-env-signoff-evidence.md`
4. **On-call + 48-hour watch roster** not documented as assigned (escalation path exists in runbooks but owner assignment required).
5. **Cross-tenant manual verification** for at least two provider/company pairs not yet recorded (automated RLS tests pass; live multi-tenant smoke pending).

### Top 5 risks (P1 — high but mitigable)

1. **Middleware does not enforce roles** — API/server layouts are authoritative; misconfigured route is highest leakage risk.
2. **`strict: false` in TypeScript** — latent type holes in edge routes.
3. **Large API surface (~561 routes)** — not every route manually re-verified for launch scope.
4. **Billing/Tripletex hybrid** — automatic invoice correctness not proven for all launch tenants.
5. **G5d.7d Preview hook smoke incomplete** — acceptable for launch (hook OFF in Production) but leaves Preview-only evidence gap.

### Intentionally frozen until after launch

- G5d.8 · employee profile runtime · source-of-truth switch · auto-rollout
- All Production `LP_MENU_PROFILE_*` flags (must remain OFF)
- `/week` hook beyond compare-only Preview evidence (G5d.7d)
- DB/RLS migrations except launch blockers
- UI redesign · broad refactors · Sanity write runtime changes · billing automation expansion

### Postponed until after launch

- G5d menu-profile cutover chain activation (G5d.8+)
- Full Tripletex automatic invoicing at scale
- Browser e2e baselines for all roles in CI
- Load/performance testing at broad SaaS scale
- Worker stub implementations (email/AI jobs)
- Growth/social/ESG external publish automation

---

## 2. Launch scope

### In scope (must work live)

| Capability | Notes |
|------------|-------|
| Provider admin | Login, menu workspace, publish |
| Company/customer admin | Active agreement, staff (within frozen lifecycle) |
| Employee ordering | `/week`, order write, cutoff |
| Menu publish | Provider → Sanity → MSDI materialization |
| Week menu display | `/week` + `GET /api/week` |
| Order creation | `POST /api/orders/set` / `lp_order_set` |
| Order status / production | Provider `/leverandor/ordrer`, `lp_order_advance_status` |
| Delivery / cutoff | 08:00 Oslo employee lock; provider GUC path |
| Provider dashboard | Orders list, status progression |
| Billing/provision basis | **Readonly basis + manual first invoice check** — not full auto-billing go-live |
| Support / manual admin | Superadmin system health, company lifecycle (frozen flows) |

### Out of scope (must NOT go live)

- G5d.8 · runtime cutover · employee profile runtime · source-of-truth switch · auto-rollout
- Production `LP_MENU_PROFILE_*` = ON
- Experimental menu-profile runtime affecting employee visibility
- Nonessential UI refactors
- Automatic menu-profile promotion to orderable candidate

---

## 3. Production flag matrix

All flags: **expected Production value = OFF/unset**. **Launch value = OFF/unset**. Owner: **Platform / Thomas**. Rollback: unset env var + redeploy (no DB rollback needed).

| Flag | Expected Production | Launch | Risk if enabled | Rollback action |
|------|---------------------|--------|-----------------|-----------------|
| `LP_MENU_PROFILE_RESOLVER` | OFF | OFF | Resolver panels/API may activate shadow paths | Unset; redeploy |
| `LP_MENU_PROFILE_FIXED_CATEGORIES` | OFF | OFF | Provider UI category experiment | Unset; redeploy |
| `LP_MENU_PROFILE_WARM_DISH_PREVIEW` | OFF | OFF | Warm dish preview panel | Unset; redeploy |
| `LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL` | OFF | OFF | Shadow mapping proposal UI | Unset; redeploy |
| `LP_MENU_PROFILE_MAPPING_DRAFT_API` | OFF | OFF | Draft persistence API | Unset; redeploy |
| `LP_MENU_PROFILE_PUBLISH_SHADOW` | OFF | OFF | Publish shadow evaluation | Unset; redeploy |
| `LP_MENU_PROFILE_WEEK_SHADOW_READ` | OFF | OFF | Week shadow read API | Unset; redeploy |
| `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER` | OFF | OFF | Compatibility evidence API | Unset; redeploy |
| `LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK` | OFF | OFF | `/week` compare hook (G5d.7c) — must not affect employee JSON when OFF | Unset; redeploy; verify `/week` unchanged |
| `LP_MENU_PROFILE_EMPLOYEE_PROFILE_RUNTIME` | not implemented / OFF | OFF | Would change employee menu source | Do not implement; unset |

**Verification:** Vercel Production env audit (keys only, no values). `/superadmin/system` must show env/runtime OK.

**Policy:** No Production menu-profile flag activation without owner final GO sign-off after P0 closure.

---

## 4. Critical user journeys

| Journey | Expected result | Automated coverage | Manual smoke | Owner | Launch status | Rollback / support |
|---------|-------------------|--------------------|--------------|-------|---------------|-------------------|
| **A. Provider login** | Lands on `/leverandor/*`, no loop | Auth tests, post-login | Login as provider admin | Ops | Ready (contract) | Reset session; check `provider_memberships` |
| **B. Provider publishes menu** | Menu visible in provider UI; Sanity publish | Menu publish tests, golden path guards | Publish or confirm week menu | Provider ops | Ready (contract) | Re-publish; check Sanity + MSDI sync |
| **C. Provider sees orders** | Own orders only in `/leverandor/ordrer` | `kitchenOrderDisplay`, RLS, loader tests | Place test order; verify card | Ops | Ready (contract) | Check `provider_id` filter |
| **D. Company active agreement** | Employee can order when ACTIVE | `domainHardening.agreementOrders` | Verify agreement status in admin | Company admin | Ready (contract) | Activate agreement; no partial writes |
| **E. Employee login** | Lands on `/week` | post-login, role tests | Employee login smoke | Ops | **Ready** (P0-1 evidence) | Password reset flow |
| **F. Employee `/week`** | Scoped menu days, locked/cutoff flags | `week-profile-lookup`, week tests | Load `/week` + `/api/week` | Ops | **Ready** (P0-1 Production smoke PASS) | Check agreement + menu publish |
| **G. Employee places order** | Order stored with correct scope | idempotency, menu-scope tests | Order one variant | Ops | Ready (contract; order not in P0-1 scope) | Support reads order by RID |
| **H. Cutoff** | After 08:00 Oslo employee blocked; provider can advance | cutoff + providerProductionCutoff | Test before/after cutoff window | Ops | Ready (contract) | Document time; no code change |
| **I. Allergens / special needs** | Visible on employee week where configured | allergen tests | Visual check one employee | Product | Ready (contract) | Support verifies profile fields |
| **J. Provider advances status** | Mottatt → … → Levert | `providerProductionStatusFlow` | Click through one order | Provider ops | Ready (contract) | Manual status via support + RPC audit |
| **K. Production / delivery list** | Kitchen/driver views scoped | kitchen/driver tests | Spot-check one list | Ops | Ready (contract) | Tenant filter in loader |
| **L. Billing basis** | Readonly basis correct or out of scope | Tripletex unit tests (partial) | Manual first invoice line check | Finance | **Conditional** | Manual invoice; defer auto |
| **M. Support diagnoses stuck user** | RID + system health | superadmin system tests | Open stuck order with RID | Support | Ready (contract) | Runbook in `docs/backoffice/RECOVERY_PLAYBOOK.md` |

---

## 5. Golden Path launch contract

### Contract (must hold at launch)

1. Provider publishes menu → materialization to MSDI when applicable  
2. Employee `/week` loads with correct company/location/provider scope  
3. Employee places order → `lp_order_set` with correct `provider_id`, `company_id`, `location_id`  
4. Provider sees order in `/leverandor/ordrer` with employee + variant display  
5. Order advances: Mottatt → I produksjon → Klar for levering → Levert  
6. No employee price/commercial exposure in `/week` or order APIs  
7. Correct provider scoping — wrong provider cannot see/update  
8. Correct company scoping — no cross-company leakage  
9. Cutoff: employee blocked after 08:00; provider production not blocked by employee cutoff  
10. Order write-path stable — no shadow menu-profile as orderable source  
11. Billing/provision not corrupted by order writes (outbox best-effort separate)

### Test command

```bash
npm run test:golden-path
```

| Field | Value |
|-------|-------|
| **Current result (audit run)** | Run at PR gate — expect all tests PASS (91 tests in suite per G5d.7c merge note) |
| **Required before launch** | PASS on release commit SHA |
| **Protected files** | See `docs/PROTECTED_GOLDEN_PATH.md` §5 and `scripts/ci/guard-protected-golden-path.mjs` |

### Rollback if Golden Path fails

1. Revert offending deploy immediately  
2. Confirm all `LP_MENU_PROFILE_*` OFF in Production  
3. Re-run `npm run test:golden-path` on revert SHA  
4. Manual smoke: employee `/week` → order → provider card  
5. File incident with RID + commit SHA  

---

## 6. Auth / roles / scoping

| Role | Behavior |
|------|----------|
| **Unauthenticated** | Middleware gates pages; `/login?next=...`; API returns 401 via `scopeOr401` |
| **provider_admin** | Full provider workspace; scoped by `provider_memberships` |
| **provider_kitchen** | Kitchen/production views; order advance when permitted |
| **provider_viewer** | Read-only provider surfaces where implemented |
| **company_admin** | Own `profiles.company_id` only — frozen `/admin/companies` |
| **employee** | `/week`, own orders; `next` allowlist `/week*` |
| **superadmin** | System + company lifecycle; allowlist gate |

### Isolation rules

- Provider cannot see other provider data — loader + RLS + `lp_assert_provider_kitchen_access`  
- Company cannot see other company data — `company_id` filter server-side  
- Employee cannot see other company data — profile scope on `/api/week` and orders  

### RLS assumptions

- Orders, agreements, menu_service_days scoped by tenant keys  
- Tests: `tests/db/provider-rls.test.ts`, `tests/rls/*`, `tests/tenant-isolation*.test.ts`  

### Pre-launch smoke tests needed

- Login each role once on Production target  
- Negative test: provider A cannot see provider B order ID  
- Negative test: company A employee cannot load company B menu context  

---

## 7. Production env / secrets audit

**Do not store secret values in this document.** Validation = presence check in Vercel + health UI.

| Env var | Required for launch? | Production | Preview | Owner | Failure mode | Validation |
|---------|---------------------|------------|---------|-------|--------------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Required | Required | Platform | Auth/DB down | CI + `/superadmin/system` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Required | Required | Platform | Client auth fail | Login smoke |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Required | Staging key | Platform | Server routes fail | API smoke |
| `SYSTEM_MOTOR_SECRET` | Yes | Required | Required | Platform | Health WARN/FAIL; motor jobs blocked | System health OK |
| `CRON_SECRET` | Yes | Required | Required | Platform | Cron/outbox fail | Cron run log |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Yes (menu) | Required | Required | CMS | Empty `/week` | Week smoke |
| `NEXT_PUBLIC_SANITY_DATASET` | Yes | production dataset | staging | CMS | Wrong menu | Publish smoke |
| `SANITY_API_TOKEN` / read | Yes | Required | Required | CMS | Menu fetch fail | `/api/week` 200 |
| `SANITY_WRITE_TOKEN` | Publish path | Required for publish | Preview | CMS | Cannot publish | Provider publish |
| `NEXT_PUBLIC_APP_URL` | Yes | Required | Preview URL | Platform | Redirect loops | Login post-login |
| `TRIPLETEX_*` | If billing in scope | Per finance decision | Test env | Finance | Invoice fail | Manual invoice test |
| `RESEND_*` / SMTP | If email in scope | Required | Optional | Platform | Invite/reset fail | Forgot password smoke |
| `NEXT_PUBLIC_SENTRY_DSN` | Recommended | Optional | Optional | Platform | Blind to errors | Sentry project |
| `E2E_EMPLOYEE_EMAIL` | Smoke only (not Production runtime) | N/A — CI/local | CI secrets | Ops | Cannot run employee smoke | Named secret check |
| `E2E_EMPLOYEE_PASSWORD` | Smoke only | N/A | CI secrets | Ops | G5d.7d blocked | Named secret check |
| `E2E_PROVIDER_*` | Smoke | N/A | CI/local | Ops | Provider smoke skip | Provider login script |
| All `LP_MENU_PROFILE_*` | Must be absent or OFF | **OFF** | OFF unless explicit Preview test | Platform | Employee menu regression | Env audit |

---

## 8. Smoke credentials requirement

### Required test users

| User | Purpose | Repo env vars |
|------|---------|---------------|
| Provider admin / kitchen | Provider login, publish, orders | `E2E_PROVIDER_KITCHEN_EMAIL`, `E2E_PROVIDER_KITCHEN_PASSWORD` or `E2E_TEST_USER_*` with provider role |
| Company admin | Agreement/staff checks | `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` |
| Employee (Golden Path) | `/week`, `/api/week`, order | **`E2E_EMPLOYEE_EMAIL`, `E2E_EMPLOYEE_PASSWORD`** |
| Superadmin | System health | `E2E_SUPERADMIN_*` |
| No-access user | Negative auth | Optional |

### Currently missing (audit evidence)

| Gap | Who provides | Validation without exposing secrets |
|-----|--------------|-------------------------------------|
| Employee Golden Path creds for G5d.7d / pre-launch smoke | **Owner (Thomas)** | `scripts/temp-g5d7d-preview-smoke.mjs` exits `AUTH_BLOCKED` when unset; hash-only login probe |
| Production-target manual smoke record | **Ops** | **P0-2 CLOSED** — `docs/launch/p0-2-production-manual-smoke-evidence.md` (2026-07-01) |

### Secure storage

- GitHub Actions secrets for CI (`ci-e2e.yml` requires 8 `E2E_*` secrets)  
- Local: `.env.local` (gitignored)  
- Never commit credentials  

### Why provider admin is invalid for `/api/week` employee smoke

- `/api/week` resolves **employee** scope via `profiles.company_id` + `location_id` + active agreement  
- Provider roles use `provider_memberships`, not employee profile scope  
- Provider session returns wrong auth context → 403 or empty fail-closed — not valid Golden Path evidence  

---

## 9. Manual smoke plan before launch

**Target:** Production `https://app.lunchportalen.no` (or explicitly agreed staging mirror with Production-equivalent config).  
**Prerequisite:** Employee + provider credentials from §8.  
**Record:** Date, operator, RID from responses, pass/fail per step.

| Step | Action | Pass criteria |
|------|--------|---------------|
| 1 | Verify Production env: all `LP_MENU_PROFILE_*` OFF | Vercel env audit + system health NORMAL |
| 2 | Login as **provider** | Lands `/leverandor/*`, no loop |
| 3 | Publish or confirm menu for launch week | Menu days visible in provider UI |
| 4 | Logout; login as **employee** (Golden Path company) | Lands `/week` |
| 5 | Load `/week` UI | Days render; no horizontal scroll; no price/commercial fields |
| 6 | `GET /api/week?weekOffset=0` (authenticated) | 200 `{ ok: true, ... }`; no forbidden keys (see G5d.7d script list) |
| 7 | Place test order (one variant) | 200; order id returned |
| 8 | Login as **provider**; open `/leverandor/ordrer` | Order visible with employee name + variant line |
| 9 | Advance status once | Status pill updates; history recorded |
| 10 | Cutoff check (if window allows) | Employee mutation blocked after 08:00; provider advance still works |
| 11 | Cross-tenant negative | Provider A cannot see other provider order |
| 12 | Support visibility | Superadmin/system or support can find order by RID |
| 13 | Cleanup | Cancel test order if policy allows |

---

## 10. Automated gates before launch

| Command | Required? | Blocker if fail? | Owner |
|---------|-----------|------------------|-------|
| `npm run typecheck` | Yes | Yes | Dev |
| `npm run lint` | Yes | Yes | Dev |
| `npm run test:golden-path` | Yes | **Yes** | Dev |
| `npm run ci:commercial-hardcodes-guard` | Yes | Yes | Dev |
| `npm run test:run` (full vitest) | Yes | Yes | CI |
| `npm run test:tenant` | Yes | Yes | CI |
| Governance tests (`tests/governance/*`) | Yes | Yes | Dev |
| RLS tests (`tests/rls/*`, `tests/db/provider-rls.test.ts`) | Yes | Yes | Dev |
| Provider menu tests | Yes | Yes | Dev |
| Order tests (`tests/api/orders*`) | Yes | Yes | Dev |
| Week tests (`tests/week/*`, `tests/api/week*`) | Yes | Yes | Dev |
| Billing tests | If billing in launch scope | Conditional | Finance |
| `npm run build:enterprise` | Yes | Yes | CI |
| `npm run e2e` | Recommended | No (skips without creds) | Ops |
| `node scripts/ci/guard-protected-golden-path.test.mjs` | On protected touches | Yes | Dev |

---

## 11. Data integrity / RLS

### Key tables

| Table | Scoping |
|-------|---------|
| `orders` | `company_id`, `location_id`, `provider_id`, `user_id` |
| `agreements` | `company_id`; ACTIVE gate for ordering |
| `menu_service_days` / `menu_service_day_items` | Provider + date materialization |
| `profiles` | `company_id`, `location_id`, role |
| `provider_memberships` | Provider tenant for provider roles |

### RLS status

- Domain hardening tests pass in CI  
- Known risk: new API routes must duplicate server guards — middleware alone insufficient  

### Pre-launch manual SQL (read-only)

- Count orders per provider for launch week (sanity)  
- Verify no orphan orders without `provider_id`  
- Agreement ACTIVE for each launch company  

### Policy

**No destructive migrations before launch** unless P0 security blocker with explicit approval and rollback plan.

---

## 12. Order write-path readiness

| Topic | Detail |
|-------|--------|
| **Endpoint** | `POST /api/orders/set` |
| **RPC** | `lp_order_set` via `lib/orders/rpcWrite.ts` |
| **Gates** | `assertCompanyOrderWriteAllowed`, agreement preflight, published menu for date, no pricing overrides in body |
| **Idempotency** | `tests/api/orders-idempotency.test.ts` |
| **Cutoff** | Enforced on employee path; provider status separate |
| **Provider visibility** | After write, visible in scoped loader |
| **Rollback** | Revert deploy; cancel order via support if needed |
| **First-day fallback** | Manual order intake via support + provider phone — document in support channel; not a code bypass |

---

## 13. Menu publish and `/week` readiness

| Topic | Detail |
|-------|--------|
| **Path to employee** | Publish → Sanity `menuDay` → optional MSDI sync → `GET /api/week` assembly |
| **Publish timing** | Provider action; materialization jobs/sync per existing publish flow |
| **Cache** | `force-dynamic` on week API; revalidation per route config |
| **MSDI fallback** | `loadEmployeeWeekMenusFromMsdi` when Sanity miss |
| **Locked / cutoff** | Returned in `/week` JSON; client respects `locked` |
| **Missing menu** | Fail-closed empty day — no wrong-provider fallback |
| **Empty `/week`** | Check agreement, publish, provider scope, Sanity dataset |
| **Support flow** | Verify publish date, agreement ACTIVE, provider binding — superadmin system health |

**Launch note:** G5d.7c hook must remain OFF in Production; employee response must match pre-hook behavior.

---

## 14. Billing / provision readiness

| Topic | Launch stance |
|-------|---------------|
| **In scope** | Readonly provision basis; manual first invoice verification |
| **Automatic invoices** | **Post-launch** unless finance signs separate GO |
| **Tripletex** | Test env proven in docs; Production keys require finance checklist |
| **Provider commission 5%** | Documented in commercial model — not exposed to employees |
| **Employee price invisibility** | Enforced by `assertEmployeeOrderBodyHasNoPricingOverrides` + commercial hardcodes guard |
| **Before first invoice** | Manual line review vs order aggregate |
| **Can wait** | Full Tripletex automation, biweekly direct invoice flags, credit-note flows |

---

## 15. Monitoring / logging / alerting

| Signal | Where | Action |
|--------|-------|--------|
| Vercel errors | Vercel dashboard | Hourly check first 48h |
| Supabase errors | Supabase logs | Auth/RLS failures |
| Auth failures | opsLog + Sentry | Spike → on-call |
| Order errors | `POST /api/orders/set` 5xx | P0 — revert deploy |
| `/week` 401/403/500 | API logs | P0 if widespread |
| Provider publish errors | Provider API logs | P1 — menu empty |
| Billing errors | Outbox / Tripletex logs | P1 — manual invoice |
| `SYSTEM_MOTOR_SECRET` missing | `/superadmin/system` | WARN/FAIL — block motor jobs |

**On-call first 48 hours:** Assign named owner + backup (Thomas + support contact).  
**Escalation:** `docs/backoffice/RECOVERY_PLAYBOOK.md`, `docs/SLO_ALERTING_RUNBOOK.md`.

---

## 16. Rollback plan

| Scenario | Action |
|----------|--------|
| Feature flag regression | Unset all `LP_MENU_PROFILE_*`; redeploy |
| Bad deploy | Vercel rollback to last green SHA |
| Golden Path break | Revert PR; re-run `test:golden-path`; manual smoke |
| Order creation failure | Revert deploy; support manual intake |
| Provider stuck | Verify `provider_memberships`; scoped loader logs |
| DB issue | **No automatic schema rollback** — forward fix or restore from backup (owner decision) |
| Do NOT auto-rollback | Agreement lifecycle data, audit events, invoiced orders |

### Communication template (providers/customers)

> Vi har identifisert et problem med [meny/ordre/levering]. Systemet er stabilisert ved [tidspunkt]. Berørte ordre for [dato] håndteres manuelt av support. RID: [rid]. Oppdatering innen [tid].

---

## 17. Launch blockers

### P0 — must fix before live

| ID | Blocker | Recommended fix (separate PR/ops) |
|----|---------|-------------------------------------|
| P0-1 | ~~Missing employee smoke credentials~~ **CLOSED** | Evidence: `docs/launch/p0-1-employee-smoke-evidence.md` (2026-06-30) |
| P0-2 | ~~Manual smoke not executed on Production target~~ **CLOSED** | Evidence: `docs/launch/p0-2-production-manual-smoke-evidence.md` (2026-07-01) |
| P0-3 | ~~Production env not signed off~~ **CLOSED** | Evidence: `docs/launch/p0-3-production-env-signoff-evidence.md` (2026-07-01) |
| P0-4 | On-call not assigned | Name primary + backup |
| P0-5 | Multi-tenant manual negative test not done | Run cross-provider check in §9 step 11 |

### P1 — high risk

| ID | Risk | Mitigation |
|----|------|------------|
| P1-1 | Middleware without role | Launch scope lock; API review for launch routes |
| P1-2 | `strict: false` | Low change freeze; monitor errors |
| P1-3 | Billing automation | Manual first invoice |
| P1-4 | G5d.7d incomplete | Accept with Production hook OFF |
| P1-5 | No load test | Low concurrency launch; watch metrics |

### P2 — launch with mitigation

| ID | Item | Mitigation |
|----|------|------------|
| P2-1 | E2E CI skips without secrets | Vitest coverage primary |
| P2-2 | Worker stubs | Do not depend on stub jobs |
| P2-3 | Social/growth surfaces | Out of launch comms |

### Post-launch backlog

- G5d.8+ menu profile cutover  
- Full Tripletex automation  
- Load testing  
- Complete browser e2e in CI  
- TypeScript `strict: true` initiative  

---

## 18. 48-hour launch watch

| Checkpoint | When | Owner |
|------------|------|-------|
| First provider login | Hour 0 | Ops |
| First menu publish | Hour 0–4 | Provider |
| First employee login | Hour 0–4 | Ops |
| First `/week` load | Hour 0–4 | Ops |
| First order | Hour 0–8 | Ops |
| First provider order view | After first order | Ops |
| First delivery status update | Same day | Provider |
| Error logs review | Every hour × 48 | On-call |
| Support channel | Continuous | Support |
| Rollback decision point | Any P0 Golden Path break | Owner |

---

## 19. Go/no-go recommendation

| Field | Value |
|-------|-------|
| **Recommendation** | **CONDITIONAL GO** |
| **Required fixes before live** | P0-4 and P0-5 (§17); P0-1 **CLOSED**; P0-2 **CLOSED**; P0-3 **CLOSED** |
| **Required manual smoke** | §9 full checklist on Production target — **P0-2 CLOSED** (`docs/launch/p0-2-production-manual-smoke-evidence.md`) |
| **Required credentials** | `E2E_EMPLOYEE_*` **verified** (P0-1 closed) + provider admin for publish/orders |
| **Postponed** | G5d.8, cutover, all Production `LP_MENU_PROFILE_*` ON |
| **Owner checklist** | ☑ P0-1 employee creds + `/api/week` smoke ☑ Full manual smoke (P0-2) ☑ Env audit (P0-3) ☑ Flags OFF ☐ Golden Path PASS ☐ On-call ☐ Comms template ready |

**Final GO** requires owner sign-off after P0 closure — not automatic from this document alone.

---

## References

- `docs/PROTECTED_GOLDEN_PATH.md`
- `docs/engineering/G5d7-compatibility-cutover-design-plan.md`
- `docs/decision/GO_NO_GO_PILOT_DECISION.md`
- `docs/live-ready/LIVE_READY_BASELINE_DELTA.md`
- `docs/environments-runtime.json`
- `scripts/ci/guard-protected-golden-path.mjs`
- `lib/menu-profile/featureFlag.ts`
- `docs/launch/p0-1-employee-smoke-evidence.md`

---

*This audit is docs-only. No runtime, API, UI, DB, RLS, Production env, or flag activation changes.*
