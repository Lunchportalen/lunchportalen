# Training and enablement plan

## 1. Principles

- Editors **must not** infer Umbraco Workflow, preview, or block constraints by exploration alone.
- Training **precedes** scenario signoff; “learn on the job” without materials **is not** a plan — it is **shadowing risk** ([`81`](./81-phase-7-risk-register.md)).
- All training references **staging** URLs and **approved** RBAC groups — not production.

## 2. Who needs training

| Audience | Required? | Topics |
|----------|-----------|--------|
| **Editors (Authors)** | **Yes** | Tree IA, cultures, blocks, media, mandatory SEO, preview, submit |
| **Approvers** | **Yes** | Inbox, approve/reject, comment policy, publish, audit reading |
| **CMS admin (pilot)** | **Yes** | User invites, group assignment, **not** fixing content for editors |
| **Support owner** | **Yes** | Escalation paths, severity model, known limitations register |
| **Product / editorial signoff owner** | **Yes** | Acceptance metrics, evidence artifacts, go/no-go |

## 3. What training they need (modules)

| Module | Objectives | Duration (guide) |
|--------|------------|------------------|
| **M1 — Authority and scope** | Umbraco = sole CMS authority for public pages; operational data elsewhere | 20 min |
| **M2 — Tree and document types** | Find `webPage` / home; folders; what **not** to edit | 30 min |
| **M3 — Blocks and validation** | Add/reorder; required fields; common validation errors | 45 min |
| **M4 — Media and accessibility** | Upload folders; picker; alt/caption policy ([`24`](../phase-2-3/24-media-localization-and-dictionary-model.md)) | 30 min |
| **M5 — Workflow** | Draft → review → approve/reject → publish; **no bypass** | 30 min |
| **M6 — Preview** | Open preview from Umbraco; interpret banner; **not** SEO canonical | 30 min |
| **M7 — Post-publish checks** | How to verify Next staging; cache delay expectations ([`45`](../phase-4/45-cache-invalidation-and-topology.md)) | 20 min |
| **M8 — AI (if enabled on staging)** | Editor AI **only** in Umbraco; **no** silent publish ([`61`](../phase-5-6/61-ai-operating-model-and-boundary.md)) | 20 min |

## 4. Session format

| Format | Use |
|--------|-----|
| **Live workshop** | M1–M7 — recorded |
| **Hands-on lab** | Staging exercises mirroring S1–S4 ([`72`](./72-editorial-scenario-matrix.md)) before pilot week |
| **Office hours** | Q&A — **does not** replace M1–M7 ([`74`](./74-support-escalation-and-coverage-model.md)) |

## 5. Prerequisites

- Umbraco **staging** accounts provisioned ([`80`](./80-manual-platform-actions-phase-7.md)).
- **Workflow** groups match [`35`](../phase-2-3/35-rbac-workflow-editor-matrix.md).
- **Quick reference** one-pager (URLs, support channel, “forbidden actions”).
- **Locale policy** printed or linked — even if single-culture ([`B2`](../phase-2-3/37-open-questions-and-blockers.md)).

## 6. Materials required

| Material | Owner |
|----------|-------|
| Slide deck or intranet page (M1–M8) | Editorial lead + CMS admin |
| **Staging** quick-reference card | Support owner |
| Link to **this** Phase 7 pack (`72`, `77`) | Solution architect |
| Known issues / workaround list (**empty ideal**) | Support owner |

## 7. Training owner

| Activity | Owner |
|----------|-------|
| Curriculum sign-off | **Product / editorial signoff owner** |
| Delivery | **Editorial lead** (or delegate trainer) |
| CMS mechanics accuracy | **CMS admin / Platform admin** |
| Security / AI boundary accuracy | **Security** (review only) |

## 8. Timeline relative to pilot

| Milestone | When |
|-----------|------|
| M1–M7 delivered | **≥2 business days** before pilot start |
| Hands-on lab completed | **≥1 business day** before pilot start |
| Pilot start | Per [`79-pilot-runbook.md`](./79-pilot-runbook.md) |
| M8 (AI) | Same week as pilot **if** editor AI enabled on staging |

## 9. Before pilot starts vs during pilot

| Must be taught **before** | May be refined **during** |
|---------------------------|---------------------------|
| Workflow, preview meaning, block validation | Niche block types discovered in content |
| Media policy | Cosmetic Umbraco skin preferences |
| Escalation paths | New defects triage outcomes |

## 10. Success criteria for training

- **100%** of pilot editors + approvers **attend** M5–M6 **live or recording + quiz**.
- **≥90%** pass **short knowledge check** (Workflow order, where preview runs, who can publish).
- **Hands-on lab:** each editor completes **S1** and **S6** with **no** engineer takeover.

## 11. Signs that training has failed

- Editors **cannot** submit without asking “what button?” for **Workflow** after training + quick reference.
- **Preview** confused with **published** URL by **>1** pilot participant after M6.
- **Repeated** **P2** defects classified as “user error” **>5** times/week — triggers training **redo** and UX review ([`75`](./75-defect-severity-cutoff-and-triage.md)).
