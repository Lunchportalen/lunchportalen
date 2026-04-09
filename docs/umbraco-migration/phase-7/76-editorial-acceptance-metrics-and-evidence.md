# Editorial acceptance metrics and evidence

**Rule:** Success is **measured** or **explicitly governed** (named owner + decision date for each exception). “Felt okay” is **not** acceptance.

Machine-readable mirror: [`acceptance-metrics.csv`](./acceptance-metrics.csv).

## 1. Metric table

| ID | Metric | Definition | Evidence artifact | Owner | Target / threshold |
|----|--------|------------|-------------------|-------|-------------------|
| **A1** | **Editor autonomy rate** | % of **completed** pilot tasks where **editor/approver** performed **all** role steps **without** engineer **live** session | Task log + attestation | Product / editorial signoff owner | **≥80%** tasks; **100%** for S7–S10 |
| **A2** | **Scenario completion** | % of **mandatory** [`72`](./72-editorial-scenario-matrix.md) rows **PASS** | Per-scenario ticket + attachment | Support owner | **100%** or **signed waiver** per row |
| **A3** | **Workflow adherence** | **Zero** publishes of in-scope types **outside** Workflow where required | Umbraco audit / Delivery publish logs | CMS admin | **0** violations |
| **A4** | **Preview trust** | Preview matches **draft** intent for **culture**; **no** published-cache bleed | HAR + server log + checklist ([`77`](./77-workflow-preview-publish-validation.md)) | Lead developer | **100%** of S6 runs **PASS** |
| **A5** | **Publish correctness** | Anonymous Next **staging** matches **Delivery** canonical fields within SLA | Screenshot + JSON hash/etag + timestamp | Lead developer | **100%** of S11 runs **PASS** |
| **A6** | **Legacy dependency** | **Zero** use of legacy editor/API for **migrated** types during pilot | Access logs + editor attestation | Security + Migration lead | **0** incidents |
| **A7** | **Support burden** | Engineer **live** hours / editor **active** pilot hours | Time log tagged **pilot-support** | Support owner | **<20%** engineer-live ratio |
| **A8** | **Defect density** | P0 count / pilot week | Tracker | Support owner | **0** open P0 at signoff |
| **A9** | **Training effectiveness** | Quiz pass + lab completion ([`73`](./73-training-and-enablement-plan.md)) | LMS or signed roster | Editorial lead | **100%** pilot cohort |

## 2. Autonomy metrics (detail)

- **Task log:** spreadsheet or tickets — each line = **task**, **actor**, **engineer_assist Y/N**, **duration**, **scenario link**.
- **Engineer assist = YES** only if **live** session **or** engineer performed **author**/**approver** actions.

## 3. Task completion metrics

- Derived from **A2** + backlog of **optional** editorial tasks (minimum **8** per [`71`](./71-pilot-scope-and-cohort.md)).

## 4. Workflow usage metrics

- **A3** supplemented by **weekly** export of Workflow transitions (if product supports) or **manual** audit sample **n≥10** publishes.

## 5. Preview trust metrics

- **S6** repeated by **each** editor **≥2** times on **different** pages.
- **Failure:** any **wrong language**, **stale published** body in preview, or **missing noindex**.

## 6. Publish correctness metrics

- Compare **Delivery API** response (server-side captured) to **Next HTML** or key field extraction — **scripted or manual** but **documented**.

## 7. Legacy dependency metrics

- **Weekly** grep of **legacy** API usage for **content_pages** writes during pilot window **or** **explicit** logging/alarm state per [`56`](../phase-5-6/56-legacy-write-freeze-and-readonly-enforcement.md) (staging).

## 8. Support burden metrics

- **A7:** sum(engineer pilot-support hours) / sum(editor pilot hours).

## 9. Evidence artifacts required (bundle)

| Artifact | Description |
|----------|-------------|
| **E1** | Completed scenario checklist (`72`) with ticket IDs |
| **E2** | Training roster + quiz results (`73`) |
| **E3** | Task log with autonomy fields (`76` A1, A7) |
| **E4** | Defect export with severities (`75`) |
| **E5** | Workflow audit sample (`76` A3) |
| **E6** | Preview packet samples (`77`) |
| **E7** | Publish parity samples (`77`) |
| **E8** | Signed [`83`](./83-phase-7-exit-checklist.md) |

## 10. Thresholds not yet signed

If **B2**, **B1**, or **SLA** numbers are unset, record **owner + decision date** in [`82`](./82-open-blockers-phase-7.md) — metric row **cannot** be green until closed.
