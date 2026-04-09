# Phase 7 exit checklist — binary gate

**Rule:** Every row **YES** for Phase 7 signoff. **NO** = **NOT READY**.

Freeze planning ([`84`](./84-readiness-for-phase-8-freeze.md)) must treat **any NO** as **stop**.

| # | Criterion | YES/NO |
|---|-----------|--------|
| 1 | **Pilot cohort** defined with named **support** and **editorial signoff** owners ([`71`](./71-pilot-scope-and-cohort.md)) | |
| 2 | **In-scope / out-of-scope** content types explicit ([`71`](./71-pilot-scope-and-cohort.md)) | |
| 3 | **Mandatory scenarios** defined with evidence columns ([`72`](./72-editorial-scenario-matrix.md)) | |
| 4 | **Training plan** complete; **M5–M6** delivered before pilot ([`73`](./73-training-and-enablement-plan.md)) | |
| 5 | **Support model** defined (channels, escalation, unacceptable dependency) ([`74`](./74-support-escalation-and-coverage-model.md)) | |
| 6 | **Severity / triage / cutoff** defined ([`75`](./75-defect-severity-cutoff-and-triage.md)) | |
| 7 | **Acceptance metrics** + evidence bundle defined ([`76`](./76-editorial-acceptance-metrics-and-evidence.md)) | |
| 8 | **Workflow / preview / publish** validation defined ([`77`](./77-workflow-preview-publish-validation.md)) | |
| 9 | **Legacy dependency register** has **no** **blocks signoff = yes** rows **without** formal exception ([`78`](./78-legacy-dependency-and-escape-hatch-register.md)) | |
| 10 | **Pilot runbook** agreed ([`79`](./79-pilot-runbook.md)) | |
| 11 | **Manual platform actions** assigned ([`80`](./80-manual-platform-actions-phase-7.md)) | |
| 12 | **Phase 7 risks** reviewed ([`81`](./81-phase-7-risk-register.md)) | |
| 13 | **Upstream blockers** closed **or** **formally accepted** with owner + date ([`82`](./82-open-blockers-phase-7.md)) | |
| 14 | **Phase 4 exit** (`52`) = **YES** with evidence (staging Delivery/Media) | |
| 15 | **Phase 5 exit** (`58`) = **YES** | |
| 16 | **Phase 6 exit** (`68`) = **YES** | |
| 17 | **Staging E2E**: import → edit → Workflow publish → Next reads Delivery → **no** legacy write success for frozen routes ([`73`](../phase-5-6/73-phase-5-6-readiness-for-phase-7.md)) | |
| 18 | **Metrics A1–A9** captured; **no** P0 open ([`76`](./76-editorial-acceptance-metrics-and-evidence.md), [`75`](./75-defect-severity-cutoff-and-triage.md)) | |
| 19 | **Product / editorial signoff owner** **written** GO | |
| 20 | **Freeze explicitly blocked** until rows **1–19** are YES (this row = acknowledgment) | |

## Hard rules

- Row **14–16** NO ⇒ Phase 7 signoff **invalid** regardless of pilot theater.
- Row **9** NO ⇒ **NOT READY** (legacy crutch).
- Row **18** NO ⇒ **NOT READY** (no measured acceptance).

## Signatures (process)

| Role | Name | Date |
|------|------|------|
| CTO | | |
| Product / editorial signoff owner | | |
| Editorial lead | | |
| Solution architect | | |
| Lead developer | | |
| Support owner | | |
| Security | | |
