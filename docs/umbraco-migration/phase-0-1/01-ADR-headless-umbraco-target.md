# ADR: Headless Umbraco (Umbraco Cloud) + Next.js presentation shell

| Field | Value |
|-------|--------|
| **Title** | Headless Umbraco on Umbraco Cloud as sole editorial authority for public website CMS content |
| **Status** | Accepted (program lock — Phase 0) |
| **Date** | 2026-04-05 |
| **Owners** | Product Owner; CTO / technical owner; Editorial owner; Security / privacy owner (names on signed checklist) |

## Decision summary

Lunchportalen adopts **Umbraco CMS hosted on Umbraco Cloud** as the **editorial and governance platform** for **public website CMS content**, consumed by the existing **Next.js** application as the **presentation and runtime shell**. Operational domains remain bound to application data stores and APIs, not to the CMS content model.

## Locked premises (non-negotiable)

1. **Target platform** = Umbraco CMS on **Umbraco Cloud**.
2. **Next.js** remains the **presentation/runtime shell** (routing, rendering, integration with operational APIs).
3. **Umbraco** is the **sole editorial authority** for **public website CMS content** (no parallel editorial peer for that scope after cutover).
4. **Operational data** stays **outside CMS scope**: menu, menuContent, weekPlan, orders, tenants, billing, immutable logs, and other operational domain data unless explicitly listed otherwise in a written charter amendment.
5. **Umbraco Workflow** is **required** for **governance parity** with enterprise editorial controls.
6. **Editor-facing AI** runs **only** in the **Umbraco editorial context** (not as a competing production editorial plane in the Next.js backoffice for migrated content).
7. **External automation** uses **dedicated API Users** with **least privilege**.
8. **Developer MCP** is **local/staging only** and is **never** part of production editorial workflow.
9. **No production cutover** while **legacy CMS write paths** remain for **migrated content types**.
10. This ADR does not depend on nor recommend any separate headless SaaS product; program scope is **Umbraco CMS on Cloud** only unless the charter is explicitly amended.

## Final architecture statement

- **Editorial plane (public website content):** Umbraco Cloud (backoffice, Workflow, headless Delivery/Media APIs as product features).
- **Consumption plane:** Next.js reads published (and later preview) content via **server-side** integration patterns; operational reads/writes continue via existing application APIs and data stores.
- **Cutover rule:** For each migrated content type, **one write authority** exists in production: **Umbraco**. Legacy write APIs and editors for that content are **removed or hard-disabled** before go-live.

## Consequences

- **Positive:** Clear editorial ownership, productized workflow, headless delivery aligned with Umbraco roadmap, separation of marketing/site content from transactional data.
- **Negative / cost:** Cloud subscription and Workflow licensing, dual run or hard freeze during migration, engineering work to replace current Postgres/Sanity-backed editorial paths for in-scope content, secret and RBAC sprawl if not disciplined.
- **Risk:** Undocumented “shadow” writes to legacy stores post-cutover — treated as **release blockers**.

## Rejected alternatives (brief)

- **Self-hosted Umbraco:** Out of scope per program lock; ops model chosen is Cloud.
- **Retaining legacy CMS as co-editor for public site content after cutover:** Rejected — violates sole editorial authority and cutover rule.
- **Moving operational domains (orders, tenants, week plans, billing) into Umbraco:** Rejected — violates operational boundary unless explicitly chartered.

## Review

Reopen only by **explicit charter amendment** (versioned ADR superseding this document). Technical tactics inside Umbraco (document types, delivery shape) are **not** ADR reopenings.
