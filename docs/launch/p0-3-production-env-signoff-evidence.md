# P0-3 — Production env owner sign-off evidence

**Status:** Evidence run · docs-only · **P0-3 CLOSED**  
**Date:** 2026-07-01  
**Branch:** `audit/p0-3-production-env-signoff`  
**Target:** `https://app.lunchportalen.no` (Production)  
**Operator:** Cursor agent (read-only env metadata audit)  
**Owner:** Thomas (platform owner)

---

## 1. Scope

| In scope | Out of scope |
|----------|--------------|
| Read-only Production env metadata audit (names/presence only) | Runtime code changes |
| Owner sign-off record | API / UI changes |
| Experimental flag OFF matrix | DB / RLS changes |
| System health cross-reference (P0-1/P0-2 + CI) | **Production env value changes** |
| Golden Path + governance gates | Feature flag activation |
| Secret leak prevention attestation | G5d.8 · cutover · SoT switch · auto-rollout |
| | P0-4 · P0-5 closure |

**No secret values are recorded in this document.**

---

## 2. Production audit target

| Field | Value |
|-------|-------|
| Production app URL | `https://app.lunchportalen.no` |
| Audit timestamp | 2026-07-01T14:55Z |
| Validation method | `vercel env ls production` (names only) · HTTP reachability probe · P0-1/P0-2 smoke references · `main` CI status |
| Main merge SHA (baseline) | `565917a849579ac9d16d863b5933374423f0b5f9` (PR #382) |
| P0-1 status | **CLOSED** — `docs/launch/p0-1-employee-smoke-evidence.md` |
| P0-2 status | **CLOSED** — `docs/launch/p0-2-production-manual-smoke-evidence.md` |
| Secret values printed | **no** |

---

## 3. Env category matrix

| Category | Required for launch | Production present | Validation method | Owner | Failure mode | Sign-off | Notes |
|----------|--------------------|--------------------|-------------------|-------|--------------|----------|-------|
| **A. App / runtime URLs** | Yes | **yes** | `vercel env ls` + HTTP probe | Platform | Redirect loops / unreachable app | **PASS** | `NEXT_PUBLIC_APP_URL`, `PUBLIC_APP_URL` present |
| **B. Supabase** | Yes | **yes** | Vercel names + P0-1/P0-2 auth smoke | Platform | Auth/DB down | **PASS** | URL, anon, service role present; `SUPABASE_DB_PASSWORD` present |
| **C. Auth / session** | Yes | **yes** | Vercel + login smoke (P0-1/P0-2) | Platform | Login fail | **PASS** | Supabase session; `SYSTEM_MOTOR_SECRET` present |
| **D. Sanity / menu publish** | Yes | **yes** | Vercel names + `/api/week` 200 (P0-1) | CMS | Empty `/week` | **PASS** | Public read via CDN (`NEXT_PUBLIC_SANITY_*`); `SANITY_WRITE_TOKEN` for publish |
| **E. Email** | Yes (reset/invite) | **yes** | Vercel names | Platform | Reset email fail | **PASS** | `RESEND_API_KEY`, `LP_RESEND_*`, SMTP/LP_SMTP_* present |
| **F. SMS** | No (not launch scope) | **n/a** | Policy | Platform | — | **N/A** | Not required for RC launch |
| **G. Billing / Tripletex** | Manual first invoice | **yes** (present) | Vercel names | Finance | Auto-invoice fail | **PASS (deferred automation)** | `TRIPLETEX_*` present; launch = readonly basis + manual QA — not broad automation |
| **H. Monitoring / logging** | Recommended | **yes** | Vercel names | Platform | Blind to errors | **PASS** | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_*` present; Vercel logs available |
| **I. Smoke credentials** | Ops (not Production runtime) | **yes** (secure store) | Operator `.env.local` names only + GH secrets list | Ops | Cannot re-run smoke | **PASS** | See §5; P0-1/P0-2 executed |
| **J. Experimental menu-profile flags** | Must be OFF/unset | **yes (zero entries)** | `vercel env ls production` | Platform | Employee menu regression | **PASS** | Zero `LP_MENU_PROFILE_*` in Production |

---

## 4. Required env names checklist

**Rule:** presence only · values **not** printed · Production environment unless noted.

### A. App / runtime URLs

| Env name | Present (Production) | Launch required | Owner | Status |
|----------|---------------------|-----------------|-------|--------|
| `NEXT_PUBLIC_APP_URL` | **yes** | yes | Platform | PASS |
| `PUBLIC_APP_URL` | **yes** | yes | Platform | PASS |
| `UMBRACO_PUBLIC_SITE_URL` | **yes** | optional (CMS legacy) | Platform | PASS |
| `UMBRACO_CMS_ORIGIN` | **yes** | optional | Platform | PASS |
| `UMBRACO_DELIVERY_BASE_URL` | **yes** | optional | Platform | PASS |

### B. Supabase

| Env name | Present (Production) | Launch required | Owner | Status |
|----------|---------------------|-----------------|-------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | **yes** | yes | Platform | PASS |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **yes** | yes | Platform | PASS |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | yes | Platform | PASS |
| `SUPABASE_DB_PASSWORD` | **yes** | yes (name only) | Platform | PASS |

### C. Auth / platform motor

| Env name | Present (Production) | Launch required | Owner | Status |
|----------|---------------------|-----------------|-------|--------|
| `SYSTEM_MOTOR_SECRET` | **yes** | yes | Platform | PASS |
| `CRON_SECRET` | **yes** | yes | Platform | PASS |

### D. Sanity / menu

| Env name | Present (Production) | Launch required | Owner | Status |
|----------|---------------------|-----------------|-------|--------|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | **yes** | yes | CMS | PASS |
| `NEXT_PUBLIC_SANITY_DATASET` | **yes** | yes | CMS | PASS |
| `NEXT_PUBLIC_SANITY_API_VERSION` | **yes** | yes | CMS | PASS |
| `SANITY_WRITE_TOKEN` | **yes** | yes (publish path) | CMS | PASS |
| `SANITY_WEBHOOK_SECRET` | **yes** | recommended | CMS | PASS |
| `SANITY_LIVE_URL` | **yes** | optional | CMS | PASS |
| `SANITY_API_TOKEN` | **no** (separate name) | read via CDN at runtime | CMS | **PASS** — employee `/api/week` 200 in P0-1; read client uses public CDN |

### E. Email

| Env name | Present (Production) | Launch required | Owner | Status |
|----------|---------------------|-----------------|-------|--------|
| `RESEND_API_KEY` | **yes** | yes | Platform | PASS |
| `LP_RESEND_FROM` | **yes** | yes | Platform | PASS |
| `LP_RESEND_LIVE_SEND` | **yes** | yes | Platform | PASS |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` | **yes** | fallback path | Platform | PASS |
| `LP_SMTP_HOST` / `LP_SMTP_PORT` / `LP_SMTP_USER` / `LP_SMTP_PASS` / `LP_SMTP_SECURE` | **yes** | fallback path | Platform | PASS |

### F. Billing / Tripletex

| Env name | Present (Production) | Launch required | Owner | Status |
|----------|---------------------|-----------------|-------|--------|
| `TRIPLETEX_BASE_URL` | **yes** | manual QA scope | Finance | PASS |
| `TRIPLETEX_CONSUMER_TOKEN` | **yes** | manual QA scope | Finance | PASS |
| `TRIPLETEX_PROVIDER_ENV` | **yes** | manual QA scope | Finance | PASS |

**Launch policy:** readonly provision basis + manual first invoice QA — **not** automatic broad billing go-live.

### G. Monitoring

| Env name | Present (Production) | Launch required | Owner | Status |
|----------|---------------------|-----------------|-------|--------|
| `NEXT_PUBLIC_SENTRY_DSN` | **yes** | recommended | Platform | PASS |
| `SENTRY_DSN` | **yes** | recommended | Platform | PASS |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | **yes** | CI/deploy | Platform | PASS |

### H. Smoke credentials (not Production runtime)

| Env name | Production Vercel | Secure store | Owner | Status |
|----------|-------------------|--------------|-------|--------|
| `E2E_EMPLOYEE_EMAIL` | **n/a** (expected) | **yes** — operator `.env.local` + GH Actions | Ops | PASS (P0-1) |
| `E2E_EMPLOYEE_PASSWORD` | **n/a** | **yes** | Ops | PASS (P0-1) |
| `MELHUS_PROVIDER_ADMIN_EMAIL` | **n/a** | **yes** — operator `.env.local` | Ops | PASS (P0-2) |
| `MELHUS_PROVIDER_ADMIN_PASSWORD` | **n/a** | **yes** | Ops | PASS (P0-2) |
| `E2E_PROVIDER_KITCHEN_*` | **n/a** | not in operator env; Melhus vars used | Ops | PASS (P0-2) |

---

## 5. Experimental flag evidence (`LP_MENU_PROFILE_*`)

**Method:** `vercel env ls production` filtered for `LP_MENU_PROFILE` — 2026-07-01  
**Result:** **zero entries** in Production environment.

| Flag | Production | Launch status | Action |
|------|------------|---------------|--------|
| `LP_MENU_PROFILE_RESOLVER` | **absent** | OFF | none |
| `LP_MENU_PROFILE_FIXED_CATEGORIES` | **absent** | OFF | none |
| `LP_MENU_PROFILE_WARM_DISH_PREVIEW` | **absent** | OFF | none |
| `LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL` | **absent** | OFF | none |
| `LP_MENU_PROFILE_MAPPING_DRAFT_API` | **absent** | OFF | none |
| `LP_MENU_PROFILE_PUBLISH_SHADOW` | **absent** | OFF | none |
| `LP_MENU_PROFILE_WEEK_SHADOW_READ` | **absent** | OFF | none |
| `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER` | **absent** | OFF | none |
| `LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK` | **absent** | OFF | none |
| `LP_MENU_PROFILE_EMPLOYEE_PROFILE_RUNTIME` | **absent** | OFF | none |
| Any other `LP_MENU_PROFILE_*` | **none found** | OFF | none |

**If any were `true`:** P0-3 would be **NOT CLOSED** — STOP.

---

## 6. System health

| Check | Result | Evidence |
|-------|--------|----------|
| Production `/` reachable | **PASS** | HTTP 307 (expected redirect) |
| Production `/login` reachable | **PASS** | HTTP 200 |
| Unauthenticated `/api/week` | **PASS** | HTTP 401 (expected) |
| Employee `/week` + authenticated API | **PASS** | P0-1 evidence |
| Full §9 Production smoke | **PASS** | P0-2 evidence |
| `main` CI (merge `565917a8`) | **PASS** | ALL PASS at PR #382 merge |
| Golden Path | **PASS** | 91/91 (2026-07-01 local) |
| Governance | **PASS** | 24/24 pre-PR; 30/30 with P0-3 guards |
| Known launch-critical env incident | **none** | — |
| On-call assigned | **OPEN** | P0-4 — not in scope for P0-3 |

**Warnings (non-blocking for P0-3):**

- Operator `E2E_SUPERADMIN_*` not valid on Production app login (documented in P0-2); RID-based support trace used.
- Tripletex automation deferred per launch policy.

---

## 7. Owner sign-off

| Field | Value |
|-------|-------|
| **Owner** | Thomas (platform owner) |
| **Timestamp** | 2026-07-01T15:00:00Z |
| **Scope** | Production env metadata on Vercel Production target for `app.lunchportalen.no` |
| **Sign-off type** | **Conditional** — launch-ready env config; final GO still blocked on P0-4 and P0-5 |

### Sign-off statement

> Owner has reviewed Production env metadata and confirms that launch-required secrets/config are present (names-only audit), no secret values are exposed in documentation, and all `LP_MENU_PROFILE_*` experimental flags are absent/OFF in Production. Sign-off remains **conditional** on P0-4 (on-call) and P0-5 (cross-tenant negative test) closure before final launch GO.

### Known exceptions

| Exception | Severity | Mitigation |
|-----------|----------|------------|
| Tripletex broad automation | P2 (deferred) | Manual first invoice QA per launch policy |
| Superadmin smoke creds on Production app | P2 (ops) | Use RID trace + staging/uigx for system health |
| On-call not named | **P0-4 OPEN** | Assign before final GO |

---

## 8. Secret leak prevention

| Check | Result |
|-------|--------|
| Secret values in this document | **no** |
| Only env names / presence / status | **yes** |
| `.env` content committed | **no** |
| Screenshots with secrets | **no** |
| `vercel env ls` values column | shows `Encrypted` only — not copied |
| **Secret leak scan** | **PASS** |

---

## 9. Golden Path and gates

| Command | Result | Timestamp |
|---------|--------|-----------|
| `npm run test:golden-path` | **91/91 PASS** | 2026-07-01 |
| `npm run typecheck` | **PASS** | 2026-07-01 |
| `npm run lint` | **PASS** | 2026-07-01 |
| `npm run ci:commercial-hardcodes-guard` | **PASS** | 2026-07-01 |
| `live-readiness-launch-audit-contracts.test.ts` | **30/30 PASS** (with P0-3 guards) | 2026-07-01 |

---

## 10. Conclusion

| Field | Value |
|-------|-------|
| **P0-3 status** | **CLOSED** |
| **Launch decision** | Remains **CONDITIONAL GO** (P0-4..P0-5 still open) |

### Closed because

1. Read-only Production env audit completed — launch-required categories **present**.  
2. Zero `LP_MENU_PROFILE_*` in Production Vercel env.  
3. No secret values exposed in documentation.  
4. System health corroborated by P0-1/P0-2 smoke + `main` CI PASS.  
5. Owner conditional sign-off recorded.  
6. Golden Path **91/91 PASS**; local gates green.  
7. No runtime changes · no Production env mutations · no flag activation.

### Remaining P0 (not in scope for P0-3)

| ID | Status |
|----|--------|
| P0-4 | OPEN — on-call primary + backup not named |
| P0-5 | OPEN — cross-tenant negative test not recorded |

### Next P0

**P0-4** — Name on-call primary + backup and document escalation path.
