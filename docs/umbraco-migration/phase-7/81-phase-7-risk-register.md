# Phase 7 risk register

**Only** risks that matter **during editorial pilot / acceptance**. Upstream technical risks remain in Phase 4–6 registers.

Machine-readable mirror: [`phase-7-risk-register.csv`](./phase-7-risk-register.csv).

| ID | Description | Why it matters now | Owner | Mitigation | Severity | Confidence |
|----|-------------|-------------------|-------|------------|----------|------------|
| R7-1 | Editors **cannot** work **without** engineer **shadowing** | Falsely passes as adoption | Product / editorial signoff owner | Training + tooling + metrics A1/A7 ([`76`](./76-editorial-acceptance-metrics-and-evidence.md)) | **High** | Med |
| R7-2 | **Preview** untrusted or flaky | Editors abandon governance; SEO/cache risks | Lead developer | [`77`](./77-workflow-preview-publish-validation.md) + fix P0 | **High** | Med |
| R7-3 | Workflow **technically on** but **socially bypassed** (admin publish) | Parity failure | CMS admin | Permissions audit + A3 metric | **High** | Med |
| R7-4 | **Locale** behavior unresolved ([`B2`](../phase-2-3/37-open-questions-and-blockers.md)) | Wrong-language publish | CTO + Product | Sign policy or **nb-only** pilot mode | **High** | High |
| R7-5 | **Legacy dependency** persists ([`78`](./78-legacy-dependency-and-escape-hatch-register.md)) | Dual authority | Migration lead | Freeze legacy writes; clean register | **Critical** | High |
| R7-6 | **Training** insufficient | Defect storm misclassified as user error | Editorial lead | M1–M7 + quiz + lab ([`73`](./73-training-and-enablement-plan.md)) | **Med** | Med |
| R7-7 | **Support burden** too high | Engineering drag; hidden failure | Support owner | Office hours + triage ([`74`](./74-support-escalation-and-coverage-model.md)) | **Med** | Med |
| R7-8 | **Triage becomes political** | Binary gates erode | CTO | Written severity definitions ([`75`](./75-defect-severity-cutoff-and-triage.md)) | **Med** | Low |
| R7-9 | **Evidence capture incomplete** | Signoff theater | Support owner | E1–E8 bundle ([`76`](./76-editorial-acceptance-metrics-and-evidence.md)) | **High** | Med |
| R7-10 | **Plugin block** gaps ([`B3`](../phase-2-3/37-open-questions-and-blockers.md)) | False “done” | Migration lead | Close inventory or quarantine policy | **Med** | Med |

## Review cadence

- **Open** at pilot kickoff.
- **Update** mid-pilot and at close.
- **Severity** High/Critical requires **CTO** awareness within **1 business day**.
