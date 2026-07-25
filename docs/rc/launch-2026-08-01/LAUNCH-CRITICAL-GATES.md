# Launch-critical gates — customer deadline 2026-08-01

Stamped: 2026-07-25T17:45:00Z  
Candidate release SHA: `d10f3e56cdf17a20c9ecf02c5f28e9f01e49a020` (release/global-menu-universes-21 tip at audit)  
Production deployment: **NOT APPROVED**

Classification key: PASS | FAIL | NOT_RUN | STALE | OWNER_APPROVAL_REQUIRED

| Gate | Status | Evidence / note |
|---|---|---|
| Exact release SHA frozen | PASS | Local/remote match `d10f3e56…` at audit; Phase 18 run #40 uses this SHA |
| Production build | NOT_RUN | Must pass `build:enterprise` on release SHA before owner deploy approval |
| Login and Auth | STALE | Prior smoke-100 (#26) PASS on older SHA; re-prove on release SHA |
| Provider/company/employee RLS | STALE | Covered by prior local/cloud isolation proofs; re-verify on release SHA |
| Menu retrieval | STALE | Prior menu-path repairs; run #40 seed reconcile in progress |
| Ordering | STALE | Smoke-100 historical; controlled ramps NOT_RUN on current SHA |
| Cancellation | STALE | Same |
| Cutoff | NOT_RUN | Phase 18 Checkpoint D |
| Capacity | NOT_RUN | Phase 18 ramps + 100k waves |
| Kitchen totals | NOT_RUN | Phase 18 production freeze |
| Packing totals | NOT_RUN | Phase 18 production freeze |
| Delivery totals | NOT_RUN | Phase 18 production freeze |
| Provider invoice basis | NOT_RUN | Phase 18 financial reconciliation |
| Exact 5% commission | NOT_RUN | Phase 18 financial reconciliation |
| Idempotency | STALE | Harness dry-run #39 PASS (10/10); scale NOT_RUN |
| Backup/restore | NOT_RUN | Separate ops gate |
| Production monitoring | NOT_RUN | Pre-deploy check |
| Kill switch | NOT_RUN | Pre-deploy check |
| Norway production regression | NOT_RUN | Must PASS before owner deploy |
| Legal clickwrap | NOT_RUN | Pre-deploy check |
| MVA threshold automation | STALE | Prior Norway work; verify live prod config pre-deploy |
| Stripe off | NOT_RUN | Pre-deploy verify |
| Zero critical security findings | NOT_RUN | Pre-deploy security review |
| Phase 18 Auth coverage | NOT_RUN | Checkpoint A after seed reconcile |
| Phase 18 controlled ramps | NOT_RUN | Checkpoint B |
| Phase 18 GLOBAL_SCALE_CERTIFIED | NOT_RUN | Full remaining gates |

## Target

`READY_FOR_OWNER_RELEASE_APPROVAL` only when every launch-critical gate is PASS
or OWNER_APPROVAL_REQUIRED (production deploy itself).

Do not deploy to production from this document alone.
