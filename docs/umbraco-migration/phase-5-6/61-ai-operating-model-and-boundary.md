# AI operating model and boundary — three lanes

## Lane A — Editor-facing AI in Umbraco

| Topic | Definition |
|-------|------------|
| **Purpose** | Accelerate drafting, SEO hints, alt text, summaries — **subordinate** to human editors |
| **Allowed actions** | Suggest text/metadata; show **diff**; fill **draft** properties **only** when editor confirms |
| **Forbidden actions** | **Publish**; approve Workflow; mutate content **without** attributable user action; call Management API from browser with secrets |
| **Identity model** | **Named Umbraco user** session + server-side AI proxy (Umbraco/Cloud boundary) |
| **Data scope** | **Single-tenant** Umbraco content visible to that editor; **no** cross-tenant batch |
| **Workflow relationship** | All live changes go through **Workflow** per Phase 2–3 |
| **Logging requirement** | Editor id, content id, capability id, prompt **class** (not raw secret), correlation id, outcome (accept/reject) |
| **Kill-switch** | Env/flag disables **AI proxy** only — editors retain manual edit |
| **Confidence** | High (aligns with Phase 0–1) |

## Lane B — External automation using API Users

| Topic | Definition |
|-------|------------|
| **Purpose** | Staging smoke, selective sync **only if** manifest-approved, search/index **read**, webhook **verification** |
| **Allowed actions** | **Documented** CRUD per **scoped** API User; **never** “admin + publish + delivery” combo |
| **Forbidden actions** | **Workflow final approve** by default; broad content wipe; use of **personal** admin creds in CI |
| **Identity model** | **One API User per integration per environment** |
| **Data scope** | Smallest subtree / content type filter Umbraco supports |
| **Workflow relationship** | Automation creates **drafts** unless explicit signed exception; **no** live publish without human gate |
| **Logging requirement** | Service identity, run id, operation, target ids, success/fail |
| **Kill-switch** | Revoke API User client secret / disable integration flag |
| **Confidence** | High |

## Lane C — Domain AI outside CMS

| Topic | Definition |
|-------|------------|
| **Purpose** | Kitchen/driver/admin insights, fraud signals, support bots, **Next** `/api/**` features unrelated to **page body** authority |
| **Allowed actions** | Operational predictions, summaries of **operational** datasets per DPA |
| **Forbidden actions** | Writing **Umbraco** content; replacing **editorial** decisions for public pages; training on **customer CMS** without legal basis |
| **Identity model** | Application service + user context for ops roles |
| **Data scope** | Operational domains **only** — menu, orders, etc. |
| **Workflow relationship** | **None** for CMS publish |
| **Logging requirement** | Existing app audit + `rid` (per `U17` evolution) |
| **Kill-switch** | Feature flag per product area |
| **Confidence** | Medium — requires vigilance against “shadow editorial” features |

## Cross-lane prohibitions

1. **Lane C** must not expose **Management** or **provider** keys to the browser for **CMS** mutations.
2. **Lane B** must not be used to **circumvent** Workflow for **editorial** content.
3. **Lane A** must not process **PII** from operational DB mixed into CMS prompts without policy.
