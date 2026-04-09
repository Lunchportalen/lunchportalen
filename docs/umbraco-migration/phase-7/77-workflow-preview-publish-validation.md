# Workflow, preview, and publish validation (pilot)

Reconciles **mandatory Umbraco Workflow** ([`05`](../phase-0-1/05-workflow-governance-decision.md)), **Phase 4 preview contract** ([`43`](../phase-4/43-preview-contract.md)), and **no silent publish** ([`65`](../phase-5-6/65-prompt-policy-and-prohibited-actions.md)).

## 1. How Workflow is validated in pilot

| Check | Method | Pass criterion |
|-------|--------|----------------|
| **Stages match design** | Compare Cloud config to [`35`](../phase-2-3/35-rbac-workflow-editor-matrix.md) | Named stages and transitions **map** 1:1 or signed delta |
| **Author cannot publish live** | Attempt direct publish as Author (should deny or not visible) | **Blocked** |
| **Approver can publish** | S10 as Approver | **Success** |
| **Audit** | Export history for S8/S9/S10 | Actor + timestamp + action **present** |

## 2. How approval / reject behavior is validated

- **Approve path:** S8 → state → S10 allowed.
- **Reject path:** S9 → author sees **comment** → revision → **re-submit** → full path again.
- **SoD:** Same person **must not** approve **own** substantive change where policy forbids — verify with **two** accounts.

## 3. How preview trust is validated

| Check | Method | Pass criterion |
|-------|--------|----------------|
| **Draft vs published** | Edit body text **without** publish; open preview | Preview shows **edit**; anonymous URL **does not** |
| **Culture** | Switch culture in backoffice; preview | Matches selected culture; **fail closed** if missing variant ([`43`](../phase-4/43-preview-contract.md) §9) |
| **Cache isolation** | Compare response headers / fetch policy | Preview **no-store** / not served from published ISR shell |
| **SEO** | View source on preview | **`noindex`** present |
| **Invalid token** | Deliberately break token (test env) | **403/404** — **no** fallback to published body |

## 4. How publish correctness is validated

| Check | Method | Pass criterion |
|-------|--------|----------------|
| **Delivery truth** | Server fetch published Delivery for node | Matches expected fields post-publish |
| **Next truth** | Anonymous staging page | Visible change after **agreed** revalidation window |
| **Webhook** | Log or observability ([`46`](../phase-4/46-webhooks-and-revalidation-contract.md)) | Event observed for publish |
| **Media** | Image URL from Media Delivery | **200** and correct transform if used |

## 5. How audit / history is checked

- Umbraco **rollback** / history UI or Management API **read** (server-side) — sample **≥5** nodes.
- **AI actions** (if any): logs match [`64`](../phase-5-6/64-ai-logging-audit-and-kill-switch.md) fields — **no** publish entries.

## 6. Governance failure (definition)

| Failure | Classification |
|---------|----------------|
| Publish reaches live **without** Workflow stage evidence | **Governance failure** — **P0** |
| AI or automation **skips** Workflow default | **Governance failure** — **P0** |
| Approver identity **not** in audit trail | **Governance failure** — **P0** |

## 7. Preview failure (definition)

| Failure | Classification |
|---------|----------------|
| Preview shows **published** when draft differs | **Preview failure** — **P0** |
| Wrong culture **silently** | **Preview failure** — **P0** |
| Preview **indexed** or **cacheable** as public | **Preview failure** — **P0** |
| Intermittent **50x** **>10%** of attempts | **Preview failure** — **P1** minimum |

## 8. What blocks freeze immediately

Any **governance failure** or **P0 preview failure** **without** fix **blocks** Phase 8 freeze readiness ([`84`](./84-readiness-for-phase-8-freeze.md)).

## 9. Relation to Phase 4 exit row 15

Staging **Delivery + Media** must be **evidenced** working ([`52`](../phase-4/52-phase-4-exit-checklist.md)); pilot **reuses** that evidence and **extends** it with **editor-triggered** preview and **Workflow-bound** publish samples.

## 10. No silent publish (cross-check)

- **Editor AI:** verify **suggestions** do not **auto-publish** ([`68`](../phase-5-6/68-phase-6-exit-checklist.md) row 5).
- **Automation API Users:** **no** publish scope for editorial lane unless **explicitly** signed exception ([`63`](../phase-5-6/63-automation-api-user-and-scope-matrix.md)).
