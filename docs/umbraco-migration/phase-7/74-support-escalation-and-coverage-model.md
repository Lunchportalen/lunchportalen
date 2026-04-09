# Support, escalation, and coverage model (pilot)

## 1. Scope

This is **pilot support**, not **production SLA**. It must still be **explicit** so “we’ll help in Slack” cannot masquerade as adoption ([`70`](./70-phase-7-master.md)).

## 2. Pilot support channels

| Channel | Purpose | Owner |
|---------|---------|-------|
| **Dedicated pilot tag** (e.g. Jira / Linear / Azure DevOps) | Defects, scenarios, evidence links | Support owner |
| **Synchronous window** (e.g. Teams/Zoom) | **Scheduled** office hours — not 24/7 | Support owner + CMS admin on rotation |
| **Escalation chat** (internal) | **P0** only | Engineering lead |

**Forbidden as sole channel:** DMs to random engineers (creates unmeasured **shadowing** — fails [`76`](./76-editorial-acceptance-metrics-and-evidence.md)).

## 3. Support owners

| Role | Responsibility |
|------|------------------|
| **Support owner** | Triage, ticket hygiene, daily pilot stand-down notes |
| **CMS admin** | Permissions, Workflow visibility, Umbraco product questions |
| **Lead developer** | Preview/Delivery/Next integration defects |
| **Platform admin** | Cloud portal, index rebuild, certificates |
| **Migration lead** | ETL/content parity questions |

## 4. Office hours / coverage model

| Parameter | Default |
|-----------|---------|
| **Coverage** | **4 hours/day** overlapping editor timezone, **5 pilot days** minimum |
| **Outside hours** | **Async** ticket; **P0** page engineering on-call **if** declared for pilot |
| **Weekends** | **Out of scope** unless charter extends pilot |

Adjust in pilot kickoff; record in [`79-pilot-runbook.md`](./79-pilot-runbook.md).

## 5. Escalation path

| Tier | Condition | Route |
|------|-----------|-------|
| **L1** | How-to, permissions, expected Workflow behavior | Support owner → CMS admin |
| **L2** | Defect suspected (preview wrong, publish fails) | Support owner → Lead developer |
| **L3** | Platform outage, index corrupt, security concern | Lead developer + Platform admin + Security |
| **L4** | Program blocker (B1/B2 unresolved affecting pilot honesty) | CTO + Product owner |

## 6. Severity model (pilot)

Aligned with [`75`](./75-defect-severity-cutoff-and-triage.md): **P0** pilot-stopper, **P1** major degradation, **P2** friction, **P3** cosmetic.

## 7. When an issue blocks the pilot

- **Any unresolved P0** for a **mandatory** scenario row ([`72`](./72-editorial-scenario-matrix.md)) **pauses** signoff clock — not necessarily all editing (see [`79`](./79-pilot-runbook.md) pause rules).
- **≥3 concurrent P0** → **full pause** until triage meeting.

## 8. When engineering must intervene

| Situation | Engineering action |
|-----------|---------------------|
| Preview **403** or wrong body vs draft | **Required** — L2 within **4 business hours** |
| Publish succeeds in CMS but Next **never** updates past SLA | **Required** — L2 + Platform |
| Workflow stuck (technical bug) | **Required** |
| Editor asks “how do I bold text” | **Not** engineering — L1/training |

## 9. When editorial lead may continue vs must stop

| Condition | Decision |
|-----------|----------|
| P2 UX issues only | **Continue**; log for backlog |
| P1 with **documented** workaround **not** violating Workflow/preview contract | **Continue** with risk note in [`82`](./82-open-blockers-phase-7.md) |
| P0 on **preview** or **publish** or **Workflow** | **Stop** scenario signoff progress until fixed or waived |

**Product / editorial signoff owner** has final say on **continue/stop** for editorial risk; **CTO** for technical **P0**.

## 10. Response expectations (pilot)

| Severity | First human response | Target resolution attempt |
|----------|----------------------|---------------------------|
| P0 | **2 business hours** | **1 business day** (or explicit ETA) |
| P1 | **4 business hours** | **3 business days** |
| P2/P3 | **1 business day** | Best effort |

## 11. Unacceptable support dependency (automatic NOT READY)

Any of the following **void** Phase 7 signoff unless **formally accepted** with owner + date:

- **>50%** of editor tasks require **live** engineer screen-share ([`76`](./76-editorial-acceptance-metrics-and-evidence.md)).
- Engineers perform **author** steps **routinely** (“I’ll just publish it for you”).
- **Workarounds** that use **legacy** editor or **Management API** for migrated types ([`78`](./78-legacy-dependency-and-escape-hatch-register.md)).
