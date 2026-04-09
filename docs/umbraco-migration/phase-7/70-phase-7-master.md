# Phase 7 master — editorial pilot and acceptance before freeze

## 1. Scope statement

Phase 7 defines **how** the organization proves — with **evidence** — that **editors and approvers** can **autonomously** create, edit, block-compose, media-manage, **preview**, **submit**, **approve/reject**, and **publish** **migrated** public website CMS content in **Umbraco on Umbraco Cloud**, with **Umbraco Workflow** as the **governance path** for publish, and **Next.js** showing **correct published output** per the **Phase 4** delivery and invalidation contracts. Operational domains (menu, week plans, orders, tenants, billing, logs, etc.) remain **out of scope** for this pilot.

## 2. What Phase 7 owns

| Area | Outcome |
|------|---------|
| **Pilot design** | Cohort, roles, environment, content-type slice, success/failure definition |
| **Scenarios** | Mandatory end-to-end editorial exercises with evidence per row ([`72`](./72-editorial-scenario-matrix.md)) |
| **Enablement** | Training plan, prerequisites, materials, completion criteria ([`73`](./73-training-and-enablement-plan.md)) |
| **Pilot support** | Channels, coverage, escalation, what blocks the pilot ([`74`](./74-support-escalation-and-coverage-model.md)) |
| **Quality gate** | Defect severities, triage, cutoff rules ([`75`](./75-defect-severity-cutoff-and-triage.md)) |
| **Acceptance** | Metrics, artifacts, owners ([`76`](./76-editorial-acceptance-metrics-and-evidence.md)) |
| **Governance proof** | Workflow + preview + publish validation methodology ([`77`](./77-workflow-preview-publish-validation.md)) |
| **Honesty register** | Legacy dependencies and escape hatches ([`78`](./78-legacy-dependency-and-escape-hatch-register.md)) |
| **Operations** | Pilot runbook ([`79`](./79-pilot-runbook.md)) |
| **Platform work** | Manual actions list ([`80`](./80-manual-platform-actions-phase-7.md)) |
| **Risks & blockers** | Phase 7 risks ([`81`](./81-phase-7-risk-register.md)), open blockers ([`82`](./82-open-blockers-phase-7.md)) |
| **Signoff gates** | Phase 7 exit ([`83`](./83-phase-7-exit-checklist.md)), Phase 8 freeze **readiness** ([`84`](./84-readiness-for-phase-8-freeze.md)) |

## 3. What Phase 7 explicitly does NOT do

- Execute **freeze** or **cutover** or **production** config changes as outcomes of this pack.
- Implement **runtime code**, **ETL**, **Delivery** clients, **preview** routes, or **webhook** handlers.
- Redesign **document types**, **element types**, **workflow stages**, **locale policy**, **AI** lanes, or **migration manifest** rules — Phase 7 **consumes** signed or explicitly risk-accepted upstream artifacts.
- Migrate or pilot **operational** data planes into Umbraco.
- Declare **pilot passed** based on demos, engineer-only walkthroughs, or subjective “felt fine” without [`76`](./76-editorial-acceptance-metrics-and-evidence.md).

## 4. Dependency on signed Phase 0–6 outputs

| Dependency | Document |
|------------|----------|
| Authority, Workflow mandate, AI/API User model | [../phase-0-1/01-ADR-headless-umbraco-target.md](../phase-0-1/01-ADR-headless-umbraco-target.md), `05`, `06` |
| Content model, editor journeys, RBAC × Workflow | [../phase-2-3/20-content-model-master.md](../phase-2-3/20-content-model-master.md), `34`, `35` |
| Published, preview, media, cache, webhooks | [../phase-4/40-phase-4-master.md](../phase-4/40-phase-4-master.md), `41`–`46`, exit `52` |
| Manifest, ETL rules, parity, freeze design | [../phase-5-6/50-phase-5-master.md](../phase-5-6/50-phase-5-master.md), `51`–`56`, exit `58` |
| AI governance, MCP boundary, API Users | [../phase-5-6/60-phase-6-master.md](../phase-5-6/60-phase-6-master.md), `61`–`66`, exit `68` |
| Cross-phase blockers | [../phase-2-3/37-open-questions-and-blockers.md](../phase-2-3/37-open-questions-and-blockers.md), [../phase-4/51-open-blockers-phase-4.md](../phase-4/51-open-blockers-phase-4.md), [../phase-5-6/72-open-blockers-phase-5-6.md](../phase-5-6/72-open-blockers-phase-5-6.md) |

**Rule:** Unresolved upstream blockers **carry forward** into [`82-open-blockers-phase-7.md`](./82-open-blockers-phase-7.md). Phase 7 **documentation** may be complete while Phase 7 **signoff** remains **NOT READY** until dependencies are closed or **formally accepted** with **owner + decision date** (per program rules in Phase 4 row 14 and Phase 5 row 13).

## 5. Hard statement: freeze cannot proceed without Phase 7 exit criteria

**Phase 8 freeze planning** must not be treated as **honest** unless [`83-phase-7-exit-checklist.md`](./83-phase-7-exit-checklist.md) is **all YES** and [`84-readiness-for-phase-8-freeze.md`](./84-readiness-for-phase-8-freeze.md) **go** conditions are satisfied. “Contract signed” or “staging exists” **does not** substitute for **editorial pilot acceptance**.

## 6. Explicit statement: acceptance is ability, not theory

Pilot acceptance means **named participants** completed **mandatory scenarios** on **staging (minimum)** with **artifacts** proving **no** required **Workflow bypass**, **no** **legacy editor** dependency for migrated types, **no** **chronic engineer shadowing**, and **preview** behavior **trusted** within Phase 4 contract — not that architects believe the design is sound.

## 7. Non-goals restated (anti-theater)

| Forbidden pattern | Phase 7 response |
|-------------------|------------------|
| Demo-only | Invalid — see [`71`](./71-pilot-scope-and-cohort.md) “not sufficient evidence” |
| Legacy Next backoffice for migrated page body | Invalid — register in [`78`](./78-legacy-dependency-and-escape-hatch-register.md) |
| Publish without Workflow where Workflow is required | Invalid — scenario failure + governance failure ([`77`](./77-workflow-preview-publish-validation.md)) |
| Preview flaky / “don’t use preview yet” | Invalid — blocks preview trust metrics ([`76`](./76-editorial-acceptance-metrics-and-evidence.md)) |
| Operational menus/orders in pilot | Out of scope — explicit exclusion ([`71`](./71-pilot-scope-and-cohort.md)) |
