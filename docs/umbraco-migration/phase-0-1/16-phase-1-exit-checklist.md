# Phase 1 exit checklist — hard gate before Phase 2

**Binary rule:** Any **false** = **STOP**. No Phase 2 content or integration work starts.

## Decision and documentation

- [ ] Target platform is named **exactly** as **Umbraco CMS on Umbraco Cloud** everywhere in this pack (no alternate CMS implied for public site content).
- [ ] `01-ADR-headless-umbraco-target.md` is **approved** by Product + CTO + Editorial + Security (initials on `07` or equivalent record).
- [ ] `02-authority-boundary-matrix.md` is **signed** with **no** ambiguous dual-authority wording for in-scope content.
- [ ] `05-workflow-governance-decision.md` acknowledged: **Workflow mandatory**; **no** soft opt-out language remains.
- [ ] `06-ai-and-access-model.md` acknowledged: **no browser management secrets**, **no production MCP editing**, **no silent AI publish**.

## Access and secrets

- [ ] `11-access-rbac-and-api-users.md` reviewed; **API User strategy** approved by CTO + Security.
- [ ] `12-secrets-and-environment-matrix.md` complete for Phase 1 rows — each row has **owner** and **rotation owner** (or explicit **PENDING** with dated task).
- [ ] **Forbidden combinations** section read and accepted by Security.

## Platform reality (honest status)

- [ ] `14-manual-platform-actions.md` filled with **assigned owners** for every **BLOCKER**-severity row relevant to this program.
- [ ] **Umbraco Cloud project** exists: **YES / NO** (if **NO**, Phase 1 exit **FAIL**).
- [ ] **Staging** environment exists: **YES / NO** (if **NO**, Phase 1 exit **FAIL** for integration start — documentation-only Phase 1 may still be “partial”; program must record **NOT READY** for Phase 2).
- [ ] **Delivery API** enabled on **staging**: **YES / NO / UNKNOWN** — **UNKNOWN** = **FAIL** until resolved.
- [ ] **Workflow** enabled on **staging**: **YES / NO / UNKNOWN** — **UNKNOWN** = **FAIL** until resolved.

*Note: “Phase 1 documentation complete” can be true while “Cloud ready” is false — Phase 2 still **blocked**. Both dimensions must be explicit.*

## Risks and blockers

- [ ] `15-risk-register-phase-0-1.md` has **no open HIGH severity** item without **owner + decision date**.
- [ ] Legal/DPA for Cloud: **VERIFIED / IN PROGRESS / REJECTED** — if **REJECTED**, exit **FAIL** and escalate charter.

## Dual authority hygiene

- [ ] No document in `/docs/umbraco-migration/phase-0-1/` implies **legacy CMS** remains an **editorial peer** for public website content after cutover.
- [ ] Operational data (menu, week, orders, tenants, billing, logs) is **explicitly excluded** from Umbraco editorial scope in signed scope docs.

## Final verdict (circle one)

**Phase 1 — READY TO EXECUTE (Phase 2):** YES / NO  

**Reason if NO:** _______________________________________________________

---

**Approver signatures (CTO + Product minimum for Phase 2 go):**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| CTO | | | |
| Product | | | |
