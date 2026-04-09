# Workflow governance decision — Umbraco Workflow required

## Statement (non-negotiable)

**Umbraco Workflow** is **mandatory** for this program to achieve **governance parity**: public website CMS content must not publish from draft to live without **defined approval stages**, **enforceable permissions**, and **auditable history** consistent with enterprise editorial expectations.

Soft wording does not apply: if Workflow cannot be operated as required, the program **does not meet** its governance gate.

## What “governance parity” means here

1. **No ad-hoc production publish** for in-scope content: a content item transitions through **explicit states** (names configurable in product) that map to draft → review → approved → published (or equivalent).
2. **Segregation of duty:** the same identity must not **by default** bypass required approvals where policy demands separation (exact rules signed by Editorial + Security).
3. **Traceability:** who approved, when, and what version went live must be recoverable from **Umbraco** audit/history features plus program logging policy (see `06-ai-and-access-model.md` for AI).
4. **Rollback posture:** expectations for revert/unpublish are **defined** (product capabilities + runbooks) — detailed implementation is Phase 2+, but **Workflow presence** is Phase 0–1 lock.

## Required approval stages (baseline)

Minimum **logical** stages (exact Umbraco Workflow configuration is **MANUAL PLATFORM ACTION**):

| Stage | Purpose |
|-------|---------|
| **Draft** | Authors work without live effect |
| **Review** | Peer or lead editorial review |
| **Approval** | Named approver group authorizes go-live |
| **Published** | Live delivery consumption allowed |

*Staging environment may use relaxed rules; **live** must enforce full chain unless Security/Editorial sign a **documented exception** (default: none).*

## Required approval roles / groups

| Group | Capability |
|-------|------------|
| **Authors** | Create/edit drafts; cannot publish to live without approval |
| **Editors** | May edit; may move to review (if policy allows) |
| **Approvers** | Approve for publish; cannot hold sole author+approver for same change if SoD required |
| **Administrators** | User/group admin, technical settings — **not** a substitute for editorial approval unless break-glass policy exists (must be rare, logged, Security-owned) |

Exact group names and mappings are **portal configuration** — must be **written down** after creation (`11-access-rbac-and-api-users.md`).

## Required audit / history expectations

- Workflow transitions are **attributed** to a **human Umbraco user** or to a **defined service identity** only where automation is explicitly allowed (automation defaults to **no publish**).
- **AI suggestions** never equate to **approval**; AI actions remain attributable per `06-ai-and-access-model.md`.
- Application-level audit logs remain authoritative for **operational** actions; **site editorial** history is authoritative in **Umbraco** for migrated content.

## What is blocked until Workflow licensing / setup is confirmed

| Blocked item | Why |
|--------------|-----|
| Phase 2 content model “go-live” design sign-off | Cannot assert governance without Workflow |
| Training editorial SOPs for migrated content | Stages unknown |
| Promises to customers/regulators on “four-eyes” publish | Unfounded |
| Decommissioning legacy application workflow flags for migrated types | Requires target Workflow proof in staging |

## Sign-off

Editorial owner + Security owner + CTO must **check** portal evidence (screenshot or admin export) that Workflow is **enabled** on **staging** at minimum before Phase 2 execution begins. **MANUAL PLATFORM ACTION.**
