# RBAC, Workflow, and editor matrix

Aligns with Phase 0–1 `05-workflow-governance-decision.md` and `11-access-rbac-and-api-users.md` (API Users separate).

## 1. User groups (Umbraco)

| Group | Create nodes | Edit content | Move / delete | Media upload | Workflow: submit | Workflow: approve | Publish live | Admin users |
|-------|--------------|--------------|---------------|--------------|------------------|-------------------|--------------|-------------|
| **Authors** | Yes (limited doc types) | Own + shared drafts | No delete on live | Yes | Yes | No | No | No |
| **Editors** | Yes | Yes (broader tree) | Yes (non-prod branches per policy) | Yes | Yes | **Maybe** peer review only | No | No |
| **Approvers** | No (default) | Fix typos **if** policy allows | No | No | No | **Yes** | **Yes** | No |
| **Web admins** | Yes | Yes | Yes | Yes | Yes | Emergency only **if** policy | Yes **break-glass** | No |
| **Administrators** | — | — | — | — | — | — | — | Yes |

*Exact names are **portal configuration** — matrix is **logical**.*

## 2. Document Type permissions (examples)

| Document Type | Authors | Editors | Approvers |
|---------------|---------|---------|-----------|
| `webPage` / `webPageHome` | Create/edit draft | Full edit | Approve only |
| `siteSettings` | No | Edit | Approve |
| `appShellPage` | If in scope | Edit | Approve |
| `editorialFolder*` | No create (folders admin) | — | — |

## 3. Workflow stage mapping

| Logical stage | Umbraco Workflow (example names) | Allowed actions |
|---------------|----------------------------------|-----------------|
| Draft | `Draft` | Save, Submit |
| Review | `In review` | Reject to draft, Forward |
| Approval | `Ready to publish` | Reject, Approve |
| Published | `Published` | Create new draft / unpublish per policy |

## 4. Content type mapping

All **`webPage`**, **`webPageHome`**, **`siteSettings`**, and editorial **`appShellPage`** use **full** Workflow unless **documented exception**.

## 5. Audit / history expectations

| Action | Expectation |
|--------|-------------|
| Save draft | Umbraco history entry |
| Workflow transition | Workflow audit + user |
| Publish | Delivery version + Umbraco log |
| API User automation | Distinct service identity; **no** silent publish without policy |

## 6. Application RBAC reminder

**Supabase / Next** roles (**superadmin**, etc.) govern **operational** apps — **not** Umbraco editorial groups. After cutover, **do not** require app login to edit public pages.

---

*See also:* [rbac-workflow-editor-matrix.csv](./rbac-workflow-editor-matrix.csv)
