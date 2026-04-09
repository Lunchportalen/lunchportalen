# Umbraco migration — Phase 7 package

This folder contains an **execution-grade editorial pilot and acceptance pack** for **Phase 7 only**: validating that **real editors** can perform **real work** in **Umbraco** on **migrated public website CMS content types**, with **Umbraco Workflow**, **trustworthy preview** (per Phase 4), and **published correctness** in **Next.js** — **before** any **Phase 8 freeze** planning is treated as honest.

## What Phase 7 is

- Pilot **scope**, **cohort**, and **environment** definition.
- **Editorial scenario matrix** (mandatory exercises, evidence per scenario).
- **Training and enablement** plan (not ad-hoc shadowing).
- **Pilot support and escalation** model (coverage, severities, stop rules).
- **Defect severity, triage, and cutoff** rules for pilot vs freeze gate.
- **Acceptance metrics and evidence** (measurable or explicitly governed).
- **Workflow / preview / publish validation** procedures aligned with Phase 4 and Phase 2–3.
- **Legacy dependency and escape hatch register** (brutal honesty).
- **Pilot runbook** (start/stop, cadence, evidence capture).
- **Manual platform actions** that cannot be done in-repo.
- **Phase 7 risk register** and **open blockers** (including upstream carry-forward).
- **Phase 7 exit checklist** and **readiness for Phase 8 freeze** (gate only — no freeze execution).

## What Phase 7 is not

- Freeze execution, cutover, ETL implementation, Delivery API implementation, preview implementation, content model redesign, workflow redesign, backoffice redesign, AI capability redesign, operational data in CMS, production rollout, or **claiming the pilot passed** without the evidence model in [`76-editorial-acceptance-metrics-and-evidence.md`](./76-editorial-acceptance-metrics-and-evidence.md).

## Upstream source of truth (mandatory)

| Pack | Path |
|------|------|
| Phase 0–1 | [../phase-0-1/00-README.md](../phase-0-1/00-README.md) |
| Phase 2–3 | [../phase-2-3/00-README.md](../phase-2-3/00-README.md) |
| Phase 4 | [../phase-4/00-README.md](../phase-4/00-README.md) |
| Phase 5–6 | [../phase-5-6/00-README.md](../phase-5-6/00-README.md) |

Hard gate from Phase 5–6 into pilot start: [../phase-5-6/73-phase-5-6-readiness-for-phase-7.md](../phase-5-6/73-phase-5-6-readiness-for-phase-7.md).

## Artifact index

| File | Purpose |
|------|---------|
| [70-phase-7-master.md](./70-phase-7-master.md) | Scope, ownership, non-goals, dependencies, freeze gate statement |
| [71-pilot-scope-and-cohort.md](./71-pilot-scope-and-cohort.md) | Pilot purpose, in/out types, roles, environment, representative pilot |
| [72-editorial-scenario-matrix.md](./72-editorial-scenario-matrix.md) | Required editorial scenarios (one row each) + evidence |
| [73-training-and-enablement-plan.md](./73-training-and-enablement-plan.md) | Who learns what, when, materials, success/failure signals |
| [74-support-escalation-and-coverage-model.md](./74-support-escalation-and-coverage-model.md) | Channels, owners, escalation, pilot-blocking conditions |
| [75-defect-severity-cutoff-and-triage.md](./75-defect-severity-cutoff-and-triage.md) | Severity classes, what blocks signoff, triage ownership |
| [76-editorial-acceptance-metrics-and-evidence.md](./76-editorial-acceptance-metrics-and-evidence.md) | Metrics, thresholds or governed exceptions, artifacts |
| [77-workflow-preview-publish-validation.md](./77-workflow-preview-publish-validation.md) | How governance and preview are proven in pilot |
| [78-legacy-dependency-and-escape-hatch-register.md](./78-legacy-dependency-and-escape-hatch-register.md) | Every legacy crutch; blocks signoff unless formally excepted |
| [79-pilot-runbook.md](./79-pilot-runbook.md) | Operational pilot sequence, checks, pause/stop |
| [80-manual-platform-actions-phase-7.md](./80-manual-platform-actions-phase-7.md) | Non-repo tasks with owners and blocking severity |
| [81-phase-7-risk-register.md](./81-phase-7-risk-register.md) | Phase 7–specific risks |
| [82-open-blockers-phase-7.md](./82-open-blockers-phase-7.md) | Unresolved items that prevent honest Phase 7 signoff |
| [83-phase-7-exit-checklist.md](./83-phase-7-exit-checklist.md) | Binary gate for Phase 7 completion |
| [84-readiness-for-phase-8-freeze.md](./84-readiness-for-phase-8-freeze.md) | What must be true before freeze **planning** starts (not freeze itself) |

### Optional structured extracts

| File | Purpose |
|------|---------|
| [editorial-scenario-matrix.csv](./editorial-scenario-matrix.csv) | Scenario matrix (machine-readable) |
| [acceptance-metrics.csv](./acceptance-metrics.csv) | Metric owners and thresholds |
| [pilot-defect-template.csv](./pilot-defect-template.csv) | Defect logging columns for pilot |
| [legacy-dependency-register.csv](./legacy-dependency-register.csv) | Escape hatches register extract |
| [phase-7-risk-register.csv](./phase-7-risk-register.csv) | Risk rows for tracking tools |

## Intentionally deferred (later phases)

| Topic | Typical owner phase |
|-------|---------------------|
| Phase 8 freeze execution and engineering guards | Phase 8 |
| Production cutover, redirect execution, legacy decommission | Post–Phase 7 |
| Full operational support model (production SLAs) | Operations / post-cutover |
| Parity automation code, webhook handlers, preview routes | Implementation phases (not Phase 7) |

## Legacy context (read-only)

Current dual-plane editorial narrative (for **understanding today**, not target authority): [`docs/umbraco-parity/CP8_EDITORIAL_WORKFLOW_CONTRACT.md`](../../umbraco-parity/CP8_EDITORIAL_WORKFLOW_CONTRACT.md). Target authority for public website CMS content after migration remains **Umbraco only**, per Phase 0–1 ADR.
