# Phase 6 master — AI + access governance

## 1. Scope statement

Phase 6 defines **governance** for:

- **Editor-facing AI** operating **only** in **Umbraco** context for **public website CMS content** (per Phase 0–1).
- **External automation** identities (**API Users**, least privilege) and their **scopes**.
- **Logging, audit, kill-switch** requirements for AI and high-risk automation touching content boundaries.
- **Prompt / policy / prohibited-action** framework (no silent publish, no workflow bypass).
- **Developer MCP** as **local/staging only**, never production editorial workflow.

## 2. What Phase 6 owns

| Deliverable | File |
|-------------|------|
| Three-lane model | `61`, `62`, `63` |
| Logging / kill-switch | `64` |
| Prompt policy | `65` |
| MCP boundary | `66` |
| Risks / exit | `67`, `68` |

## 3. What Phase 6 explicitly does NOT do

- **Migration ETL** design or canonical transform via AI (`50`–`58`).
- **Implement** Umbraco packages, custom dashboards, or Next.js AI routes (implementation is product work **after** governance signoff).
- **Change** Umbraco Workflow stages or document types (Phase 2–3).
- **Redesign** Delivery / Preview / cache (Phase 4).
- **Approve** production use of MCP for live content.

## 4. Hard boundary: editor AI vs automation vs domain AI

| Lane | One-line |
|------|----------|
| **A — Editor AI (Umbraco)** | Human-in-the-loop assistance inside backoffice; **never** silent publish |
| **B — Automation (API Users)** | Server-side, scoped, **no** default Workflow approval rights |
| **C — Domain AI (app)** | Operational / product AI (orders, insights, etc.) — **must not** become shadow editorial authority |

See [`61-ai-operating-model-and-boundary.md`](./61-ai-operating-model-and-boundary.md).

## 5. Non-weakening of editorial authority

Phase 6 **must not** weaken:

- **Umbraco** as sole editorial authority for migrated CMS content.
- **Umbraco Workflow** as governance gate for publish.

Any exception requires **Security-signed** ADR with expiry — **default: none**.

## 6. Dependency on Phase 0–1 and Phase 2–3

| Input | Use |
|-------|-----|
| `06-ai-and-access-model.md` | Baseline locks (browser secrets, MCP, kill-switch) |
| `11-access-rbac-and-api-users.md` | RBAC patterns, forbidden combinations |
| Phase 2–3 RBAC/workflow matrix | Editor groups vs Approver |
| `U17` (repo) | Current Next AI posture — **retire** editorial scope at cutover |

## 7. Hard gate

Phase 6 signoff requires [`68-phase-6-exit-checklist.md`](./68-phase-6-exit-checklist.md) **all YES** and blockers in `72` closed or explicitly accepted.
