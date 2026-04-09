# Pilot runbook (operational)

**Not cutover.** This runbook governs **how the pilot runs**, not production switch.

## 1. Pilot start conditions

| # | Condition | Evidence |
|---|-----------|----------|
| S1 | [`73`](./73-training-and-enablement-plan.md) M1–M7 complete for cohort | Roster + quiz |
| S2 | Staging accounts + groups ([`80`](./80-manual-platform-actions-phase-7.md)) | Admin checklist |
| S3 | Workflow configured per [`35`](../phase-2-3/35-rbac-workflow-editor-matrix.md) | Screenshot / export |
| S4 | Delivery + Media + index smoke **green** ([`52`](../phase-4/52-phase-4-exit-checklist.md) row 15) | Linked note |
| S5 | Representative content present ([`71`](./71-pilot-scope-and-cohort.md)) | Tree export |
| S6 | Support channel + owners active ([`74`](./74-support-escalation-and-coverage-model.md)) | Channel live |
| S7 | **CTO GO** for pilot start per [`73-phase-5-6-readiness-for-phase-7`](../phase-5-6/73-phase-5-6-readiness-for-phase-7.md) (program gate) | Email/ticket |

**If S7 NO:** pilot may run as **dry rehearsal** only — **must not** sign [`83`](./83-phase-7-exit-checklist.md).

## 2. Pilot end conditions

| # | Condition |
|---|-----------|
| E1 | All **mandatory** [`72`](./72-editorial-scenario-matrix.md) rows **PASS** or **waived** with signoff |
| E2 | Metrics [`76`](./76-editorial-acceptance-metrics-and-evidence.md) **green** or **governed** |
| E3 | **Zero** open **P0** ([`75`](./75-defect-severity-cutoff-and-triage.md)) |
| E4 | **Product / editorial signoff owner** written decision |
| E5 | [`83`](./83-phase-7-exit-checklist.md) complete |

## 3. Sequencing (recommended)

| Day | Focus |
|-----|-------|
| **D-2** | Training lab S1–S4 |
| **D-1** | Dry run S6–S8; fix **P0** |
| **D1** | Kickoff; S1–S4 real content |
| **D2** | S5 or S5-alt; S6 deep |
| **D3** | S7–S10 cycle |
| **D4** | S11; `siteSettings` if in scope |
| **D5** | S9 repeat; regression; metrics close |

## 4. Daily / weekly cadence

| Cadence | Activity | Owner |
|---------|----------|-------|
| **Daily 15 min** | Pilot stand-up: blockers, P0 | Support owner |
| **Daily EOD** | Task log update ([`76`](./76-editorial-acceptance-metrics-and-evidence.md)) | Editors |
| **Mid-pilot** | Metrics review | Product + Lead dev |
| **End** | Retrospective | Full cohort |

## 5. Environment readiness checks

- Umbraco Cloud **staging** health green.
- Next **staging** env vars for Delivery/preview present (no secrets in client).
- **Webhook** receiver reachable from Umbraco staging (or documented deferral with **no** S11 claim).

## 6. Participant readiness checks

- Each editor: **lab** complete.
- Each approver: **test** reject path on **throwaway** node.

## 7. Evidence capture steps

1. For each scenario row: create **ticket** `PHASE7-S{n}`.
2. Attach **screenshots** + **URLs** + **timestamps**.
3. Link **Delivery** evidence for S10/S11 (server-side OK).
4. Bundle **E1–E8** per [`76`](./76-editorial-acceptance-metrics-and-evidence.md).

## 8. Stop / pause criteria

| Trigger | Action |
|---------|--------|
| **1 P0** on Workflow/preview/publish | **Pause** scenario signoff for that track |
| **≥3 P0** open | **Full pause**; war room |
| **Security** incident | **Stop**; L4 escalation |
| **Upstream** blocker discovered (e.g. dual-write) | **Stop**; update [`82`](./82-open-blockers-phase-7.md) |

## 9. Rollback of pilot participation

- **Revoke** staging accounts (not production).
- **Archive** pilot content branch or reset nodes **per CMS admin** procedure.
- **Preserve** tickets and evidence **7 years** per org policy (default reference Legal).

## 10. End-of-pilot review agenda

1. Metrics dashboard [`76`](./76-editorial-acceptance-metrics-and-evidence.md).
2. Open defects trend [`75`](./75-defect-severity-cutoff-and-triage.md).
3. Legacy register [`78`](./78-legacy-dependency-and-escape-hatch-register.md) — must be **clean** for signoff.
4. Decision: **Phase 7 signoff** vs **NOT READY** vs **extend pilot** (new end date).
