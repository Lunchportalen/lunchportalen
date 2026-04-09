# Access, RBAC, and API Users

## Editor roles (human)

| Role | Typical permissions |
|------|---------------------|
| **Author** | Create/edit own drafts; submit to review; no live publish |
| **Editor** | Broader edit on allowed sections; may move items in Workflow per policy |
| **Approver** | Approve/reject for publish; may be limited to specific content roots |
| **CMS Admin** | User invites, group assignment, technical settings (separate from Approver unless policy merges them — default: **separate**) |

*Exact permission matrices are **product configuration** — **MANUAL PLATFORM ACTION** after environments exist.*

## Approver roles

- Mapped to **Umbraco Workflow** “approve” transitions on **live**.
- **Segregation of duty:** default **deny** same person **author + final approver** for regulated content unless Security documents exception.

## Admin roles

- **Umbraco Cloud portal admins** (billing, environment access) — vendor role; keep **minimal** people.
- **Umbraco backoffice admins** — technical; must not be used for **routine** content to avoid attribution noise.

## API Users for integrations

| Purpose | Scopes (principle) | Environments |
|---------|-------------------|--------------|
| **Read published content** (future Delivery consumer from automation) | Read-only delivery | staging first, then live |
| **Revalidation / webhook receiver validation** | Verify signatures only in app; Umbraco side issues secrets | staging, live |
| **CI smoke** | Minimal read; **no** publish | dev/staging only |
| **Search/index builder** (if off-Next) | Read delivery; **no** Management unless unavoidable | per Security review |

**Rule:** New integration = **new API User** or **documented** scope extension — no default reuse.

## Least-privilege rules

1. **Smallest** scope that satisfies the integration.
2. **Separate** credentials per environment (no staging key on live).
3. **Rotation** on compromise or team change — owner in `12-secrets-and-environment-matrix.md`.
4. **Never** embed in client-side code.

## Who may call Management API

| Allowed | Not allowed |
|---------|-------------|
| Server-side automation with **dedicated API User** and **documented** runbook | Browser, mobile app, public edge without auth |
| Break-glass operational scripts (Security-approved, rare) | Developers’ personal credentials in CI |

## Who may not call Management API

- **End users** of Lunchportalen (employees, admins in **application** sense) unless they are **also** authenticated via **Umbraco** as editorial users — operational app auth **does not** imply Management API access.
- **Third parties** without contract + IP allowlist + scoped key.

## Who may use Developer MCP

- **Engineers** on **local** or **staging** only.
- **Nobody** for **live** editorial mutations as standard workflow.

## Who may approve publish

- **Umbraco users** in **Approver** group (Workflow), excluding those blocked by SoD policy.
- **Not** API Users by default (automation must not approve human Workflow unless explicit future Security exception).

## Who may trigger automation

- **Defined service accounts** (API Users) with **written** purpose.
- **Humans** only through **explicit** tools (e.g. “run import” button behind admin gate) — Phase 2+ design.

## Forbidden combinations

| Combination | Why forbidden |
|-------------|---------------|
| API User with **admin + publish + delivery** all-in-one | Blast radius |
| Shared API User across **unrelated** vendors | Attribution and revocation impossible |
| Management API key in **Next client bundle** | Secret theft |
| MCP with **live** write token | Program lock |
| **Application superadmin** impersonating **editorial** publish without Umbraco audit | Dual authority |

## Temporary bootstrap exceptions

**Default: none.**

If a one-time bootstrap requires elevated access (e.g. initial import service account), record:

- **Time window**
- **Owner**
- **Revocation date**
- **Security approval reference**

Absent that record, bootstrap mode is **invalid**.
