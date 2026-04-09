# Defect severity, cutoff, and triage (pilot)

## 1. Severity classes

| Class | Definition | Pilot examples |
|-------|------------|----------------|
| **P0** | **Pilot-stopper:** mandatory scenario ([`72`](./72-editorial-scenario-matrix.md)) **cannot** complete honestly **or** governance contract violated | Publish without Workflow; preview shows **wrong** culture or **published** body; total publish failure; media **loss**; silent Workflow bypass |
| **P1** | **Major degradation:** scenario completable only with **unsafe** workaround **or** **frequent** failure **or** **wrong** SEO/indexing behavior on **published** | Intermittent preview fail; revalidation **> agreed SLA** consistently; approver cannot see comments |
| **P2** | **Friction:** extra clicks, unclear copy, slow UX, non-blocking validation annoyance | Block picker overwhelming; minor label confusion **fixed** by training doc update |
| **P3** | **Cosmetic** | Spacing in backoffice; typos in internal field descriptions |

## 2. What blocks Phase 7 signoff

- **Any open P0** affecting **in-scope** types **without** dated risk acceptance (owner + product + CTO as applicable).
- **Pattern:** **≥2** distinct P1 items that **encourage** Workflow bypass or “engineer publish” culture.
- **Hidden legacy dependency** discovered mid-pilot ([`78`](./78-legacy-dependency-and-escape-hatch-register.md)) — treated as **P0** until removed or **formally** excepted.

## 3. What may be accepted temporarily (with governance)

| Condition | Allowed? | Record |
|-----------|----------|--------|
| P2/P3 backlog | **Yes** | Backlog link + fix-before-freeze flag optional |
| P1 with **written** workaround **not** violating Phase 4/6 | **Yes** | [`82`](./82-open-blockers-phase-7.md) + expiry date |
| P0 | **No** for signoff | Must fix or **stop** pilot |

## 4. What must be fixed before Phase 8 freeze

- **All** P0 from pilot **closed** or **reclassified** with evidence.
- **Zero** **open** rows in [`78`](./78-legacy-dependency-and-escape-hatch-register.md) marked **blocks signoff = yes** (unless program exception signed).
- **Preview trust** and **Workflow** metrics in [`76`](./76-editorial-acceptance-metrics-and-evidence.md) at **green** or formally waived.

## 5. Triage ownership

| Role | Authority |
|------|-----------|
| **Support owner** | Initial severity assignment, duplication merge |
| **Lead developer** | Technical reclassification (P0 vs P1) |
| **Product / editorial signoff owner** | UX severity disputes, acceptance of P1 workarounds |
| **CTO** | Final call on pilot **stop/resume** for P0 volume |

## 6. How triage decisions are recorded

- Every defect: **ticket** with **severity**, **scenario ID** (S1–S12), **environment**, **evidence** link.
- Severity changes: **comment** with actor + rationale.
- Waivers: **link** from ticket to [`82`](./82-open-blockers-phase-7.md) row or risk register addendum.

## 7. Pilot-failing defect patterns (automatic review)

| Pattern | Action |
|---------|--------|
| **Preview mismatch** >1 occurrence / culture | Freeze **preview trust** metric; escalate to L3 |
| **Publish failure** >5% of attempts | Stop pilot; incident |
| **Wrong Workflow** (wrong stage transitions) | P0 until fixed |
| **Media “missing” after publish** | P0 |
| **Locale** wrong on **anonymous** published | P0 (ties **B2**) |
| **Editor confusion** same issue **>5** tickets | UX review + training audit |
| **Engineer hand-holding** spike | See [`76`](./76-editorial-acceptance-metrics-and-evidence.md) |
