# CRO permissions and safety

CRO (conversion-rate optimization) in the content editor is permissioned and fail-closed as follows.

## No dedicated CRO server route

- **CRO analysis** runs entirely client-side (`analyzePageForCro`, `computeCroScore`, `buildCroSuggestions` in the browser). There is no `/api/backoffice/ai/cro` or similar. Unauthorized users cannot call a privileged CRO “generate” API because it does not exist.
- **CRO apply** is client-side: `applyCroSuggestionToContent` updates in-memory meta only. Persistence happens only when the user saves the page, using the same **content PATCH** flow as manual edits.

## Where authorization is enforced

| Touchpoint | Guard | Effect |
|------------|--------|--------|
| **Backoffice layout** | `getAuthContext()`; redirect if not authenticated; redirect if `role !== "superadmin"` to `roleHome(role)` | Only **superadmin** can reach `/backoffice/*`, including the content editor and the CRO tab. |
| **Content pages GET/PATCH** (`/api/backoffice/content/pages/[id]`) | `scopeOr401` then `requireRoleOr403(ctx, ["superadmin"])` | Only superadmin can load or save pages. CRO-applied meta is saved via the same PATCH as manual edits; no separate path. |
| **Editor-AI metrics** (`/api/editor-ai/metrics`) | `scopeOr401` then `requireRoleOr403(ctx, ["superadmin", "company_admin"])` | CRO events (cro_analysis, cro_apply, cro_dismiss) use the same gate as other editor-AI events. In practice only superadmin can open the backoffice, so only superadmin triggers CRO from the editor. |

## Fail-closed behavior

- **Missing or broken auth:** `scopeOr401` returns 401 when unauthenticated; callers use `if (!s?.ok) return denyResponse(s)`. `denyResponse(null)` returns 401. So missing/broken auth state does not grant access.
- **Wrong role:** `requireRoleOr403` returns 403; route returns that response and does not execute the handler.

## CRO does not bypass CMS rules

- CRO apply only updates editor state (meta). Saving goes through the same content PATCH API as manual edits. There is no path where CRO can write content without passing the same authorization as a normal save.
- Any future server-side CRO route (e.g. server-run analysis) **must** use the same pattern: `scopeOr401` then `requireRoleOr403(ctx, ["superadmin"])` to align with content write access.

## Summary

- Unauthorized users cannot access privileged CRO actions: they cannot reach the editor (layout) or the content API.
- There are no server-side CRO routes; the only server paths involved are the existing content API (load/save) and editor-AI metrics, both already guarded.
- CRO apply is protected at least as strictly as manual edit: same PATCH, same role check.
- Missing/broken auth fails closed (401/403).
- CRO AI does not bypass CMS permission rules; it has no separate write path.
