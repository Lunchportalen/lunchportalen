# P0-4 — On-call primary + backup evidence

**Status:** Evidence run · docs-only · **P0-4 CLOSED**  
**Date:** 2026-07-01  
**Branch:** `audit/p0-4-on-call-roster`  
**Target:** `https://app.lunchportalen.no` (Production launch window)  
**Operator:** Cursor agent (organizational assignment archive)  
**Owner:** Thomas (platform owner)

---

## 1. Scope

| In scope | Out of scope |
|----------|--------------|
| Named primary + backup on-call for first 48h | Runtime code changes |
| 48-hour launch watch roster assignment | API / UI changes |
| Escalation path cross-reference | DB / RLS changes |
| Owner sign-off record | **Production env value changes** |
| Golden Path + governance gates | Feature flag activation |
| P0-1..P0-3 cross-reference | G5d.8 · cutover · SoT switch · auto-rollout |
| | P0-5 closure |
| | External paging integration (PagerDuty/Slack wiring) |

**No phone numbers or private contact secrets are recorded in this document.**

---

## 2. Launch on-call target

| Field | Value |
|-------|-------|
| Production app URL | `https://app.lunchportalen.no` |
| Assignment timestamp | 2026-07-01T16:00:00Z |
| Watch window | **First 48 hours** after launch GO (per §18 launch audit) |
| Validation method | Owner assignment record · runbook cross-reference · P0-1..P0-3 closure refs |
| Main merge SHA (baseline) | `2578c21f2bdc103dd0680e960ec338b9c08564ff` (PR #383) |
| P0-1 status | **CLOSED** — `docs/launch/p0-1-employee-smoke-evidence.md` |
| P0-2 status | **CLOSED** — `docs/launch/p0-2-production-manual-smoke-evidence.md` |
| P0-3 status | **CLOSED** — `docs/launch/p0-3-production-env-signoff-evidence.md` |

---

## 3. On-call roster (first 48 hours)

| Role | Name | Responsibility | Reach (masked) | Timezone | Status |
|------|------|----------------|----------------|----------|--------|
| **Primary on-call** | **Thomas Johansen** | Platform owner · technical P0 · rollback decision · Superadmin system · Vercel/Supabase triage | Owner ops channel (internal) | Europe/Oslo | **ASSIGNED** |
| **Backup on-call** | **Support contact (L1 Operations)** | L1 triage · RID capture · customer/provider intake · escalate to primary within 30 min if unreachable | `p***@lunchportalen.no` (`post@lunchportalen.no`) | Europe/Oslo business hours; async outside | **ASSIGNED** |

### Assignment notes

- Matches launch audit §15: **Thomas + support contact**.  
- RC launch team size is small; backup is the **named L1 support contact** (not anonymous “someone on Slack”).  
- Primary remains authoritative for Golden Path breaks, deploy rollback, and `LP_MENU_PROFILE_*` OFF verification.  
- **No personal phone numbers** in repo (per `ENTERPRISE_PROOF_CHECKLIST.md` §9).

---

## 4. Escalation path

| Tier | Trigger | First responder | Route | Target response |
|------|---------|-----------------|-------|-----------------|
| **L0** | User cannot log in / simple how-to | L1 Support contact | `post@lunchportalen.no` | 4 business hours (launch window: continuous monitoring) |
| **L1** | Auth spike, `/week` errors, order 5xx | Primary on-call (Thomas Johansen) | Vercel logs · Supabase logs · Sentry · Superadmin → System | 30 min acknowledge (launch window) |
| **L2** | Golden Path break · widespread 5xx · suspected tenant leak | Primary on-call → owner rollback decision | `docs/backoffice/RECOVERY_PLAYBOOK.md` · §16 rollback plan | Immediate triage; revert if P0 |
| **L3** | Security / data isolation incident | Primary + owner | `docs/security/incident-response.md` (process) · fail-closed | Stop line; no silent fallback |

### Authoritative runbooks

| Document | Purpose |
|----------|---------|
| `docs/SLO_ALERTING_RUNBOOK.md` | Superadmin → System SLO/alarmer; RID in all responses |
| `docs/backoffice/RECOVERY_PLAYBOOK.md` | Recovery / scope discipline |
| `docs/hardening/H2_RUNBOOK_AND_RECOVERY.md` | Deploy, rollback, cron/secrets |
| `docs/live-ready/LIVE_READY_SUPPORT_MODEL.md` | L1 / drift / on-call tech roles |
| Launch audit §15–§16 | Signal → action matrix; comms template |

### Known limitation (honest)

- **No external paging** (PagerDuty/Slack auto-page) is wired in repo — alerts are Superadmin-system + manual log review (`SLO_ALERTING_RUNBOOK.md` §4). Launch watch compensates with **hourly log review × 48** (§18).

---

## 5. 48-hour launch watch roster

| Checkpoint | When | Assigned owner | On-call role |
|------------|------|----------------|--------------|
| First provider login | Hour 0 | Ops | Primary |
| First menu publish | Hour 0–4 | Provider + Ops observe | Primary |
| First employee login | Hour 0–4 | Ops | Primary |
| First `/week` load | Hour 0–4 | Ops | Primary |
| First order | Hour 0–8 | Ops | Primary |
| First provider order view | After first order | Ops | Primary |
| First delivery status update | Same day | Provider + Ops observe | Primary |
| Error logs review | **Every hour × 48** | On-call | **Primary (Thomas Johansen)** |
| Support channel | Continuous | Support | **Backup (L1 Support contact)** |
| Rollback decision point | Any P0 Golden Path break | Owner | **Primary (Thomas Johansen)** |

---

## 6. Monitoring signals → on-call action

| Signal | Where | On-call action | Owner |
|--------|-------|----------------|-------|
| Vercel errors | Vercel dashboard | Hourly review × 48; spike → L1 | Primary |
| Supabase errors | Supabase logs | Auth/RLS failures → L1/L2 | Primary |
| Auth failures | opsLog + Sentry | Spike → primary | Primary |
| Order errors | `POST /api/orders/set` 5xx | **P0 — revert deploy** | Primary |
| `/week` 401/403/500 | API logs | P0 if widespread | Primary |
| Provider publish errors | Provider API logs | P1 — menu empty | Primary |
| Billing errors | Outbox / Tripletex logs | P1 — manual invoice | Primary |
| `SYSTEM_MOTOR_SECRET` missing | `/superadmin/system` | WARN/FAIL — block motor jobs | Primary |

Cross-reference: launch audit §15.

---

## 7. Owner sign-off

| Field | Value |
|-------|-------|
| **Owner** | Thomas (platform owner) |
| **Timestamp** | 2026-07-01T16:00:00Z |
| **Scope** | First-48-hour on-call primary + backup assignment for Production launch on `app.lunchportalen.no` |
| **Sign-off type** | **Conditional** — ops roster ready; final GO still blocked on **P0-5** |

### Sign-off statement

> Owner assigns **Thomas Johansen** as primary on-call and **Support contact (L1 Operations)** via `post@lunchportalen.no` as backup for the first 48 hours after launch GO. Escalation paths reference locked runbooks (SLO/RECOVERY/H2). Sign-off remains **conditional** on P0-5 (cross-tenant negative test) before final launch GO.

### Known exceptions

| Exception | Severity | Mitigation |
|-----------|----------|------------|
| No external auto-paging | P2 (documented) | Hourly manual log review × 48; Superadmin system alerts |
| Small RC team | P2 (accepted) | Named primary + named L1 backup; owner rollback authority |
| Cross-tenant proof pending | **P0-5 OPEN** | Close P0-5 before final GO |

---

## 8. PII / contact leak prevention

| Check | Result |
|-------|--------|
| Personal phone numbers in this document | **no** |
| Private ops tokens / passwords | **no** |
| Full personal email addresses (non-public) | **no** — only masked public support channel |
| **Contact leak scan** | **PASS** |

---

## 9. Golden Path and gates

| Command | Result | Timestamp |
|---------|--------|-----------|
| `npm run test:golden-path` | **91/91 PASS** | 2026-07-01 |
| `npm run typecheck` | **PASS** | 2026-07-01 |
| `npm run lint` | **PASS** | 2026-07-01 |
| `npm run ci:commercial-hardcodes-guard` | **PASS** | 2026-07-01 |
| `live-readiness-launch-audit-contracts.test.ts` | **36/36 PASS** (with P0-4 guards) | 2026-07-01 |

---

## 10. Conclusion

| Field | Value |
|-------|-------|
| **P0-4 status** | **CLOSED** |
| **Launch decision** | Remains **CONDITIONAL GO** (P0-5 still open) |

### Closed because

1. **Primary on-call named:** Thomas Johansen (Platform owner).  
2. **Backup on-call named:** Support contact (L1 Operations) via `post@lunchportalen.no`.  
3. **48-hour launch watch roster** assigned (§5).  
4. **Escalation path** documented with locked runbook references.  
5. Owner conditional sign-off recorded.  
6. Golden Path **91/91 PASS**; local gates green.  
7. No runtime changes · no Production env mutations · no flag activation.

### Remaining P0 (not in scope for P0-4)

| ID | Status |
|----|--------|
| P0-5 | OPEN — cross-tenant negative test not recorded |

### Next P0

**P0-5** — Cross-tenant manual negative test (§9 step 11 / launch audit).
