# Scope boundary — Phase 0–1

## 1. What moves into Umbraco

- **Public website CMS content** that today lives in the application CMS model (pages, composed blocks, site SEO/meta tied to those pages, site navigation structure when it is editorial content).
- **Editorial media** that exists to serve that site content (images, documents referenced by pages).
- **Localization of that site content** (cultures/variants as modeled in Umbraco).
- **Editorial identities and permissions** for the above (Umbraco users, groups, Workflow stages).
- **Governance** for the above via **Umbraco Workflow** (approvals, audit trail expectations as defined in `05-workflow-governance-decision.md`).

*Phase 0–1 does **not** implement the move; it only locks that this is the destination scope.*

## 2. What stays in Next.js / Supabase / domain APIs

- **Next.js** as runtime shell: routing, rendering, integration, caching policies (product code — unchanged in Phase 0–1).
- **Operational domains:** orders, tenants, billing, menus/menuContent/week plans, kitchen/driver/admin operational views, authentication for **application** users, tenant isolation, immutable logs, and any API that is not “public website editorial content.”
- **Application RBAC** for operational surfaces (unchanged in authority; not replaced by Umbraco groups for non-editorial apps).

## 3. What is explicitly out of scope in Phase 0–1

- Content type design, document type implementation, property editors.
- ETL, import/export, dual-write sync jobs.
- Preview route implementation, ISR/edge integration details, webhook handlers in Next.
- Production cutover, redirects catalog, SEO parity QA of migrated URLs.
- Decommissioning legacy editors (scheduled for post-foundation phases; **decision** only here).
- SSO end-to-end implementation (may be **listed** as manual platform work if in roadmap).

## 4. What is forbidden

| Forbidden | Rationale |
|-----------|-----------|
| **Dual writes** for the same migrated content type (legacy CMS + Umbraco) in production | Breaks sole authority; causes irreconcilable drift |
| **Parallel editorial ownership** for public website CMS content | Same as dual authority — not allowed after cutover |
| **Browser-exposed management secrets** (Delivery API keys, API User secrets, webhook signing secrets in client bundles) | Unacceptable security posture; **INVALID** design |
| **Production MCP editing** or any path where Developer MCP mutates live editorial content | MCP is **local/staging only** per program lock |
| **Silent AI publish** (AI applying changes without attributable user/service identity and without policy) | Governance and audit failure |
| **Cutover** while legacy **write** paths remain for migrated content | Program lock |
