# Editor–AI permission model

**Purpose:** Editor AI actions are correctly permissioned and fail closed. Unauthorized users cannot use privileged editor AI; server-side routes enforce the same authorization as manual edit; missing or broken auth state fails closed.

## 1. Gate hierarchy

- **Layout (UI):** `app/(backoffice)/backoffice/layout.tsx` — only `superadmin` may access the backoffice. Any other role (including `company_admin`) is redirected to `roleHome(role)`. So the editor surface is never rendered for non-superadmins.
- **Content pages API (manual edit):** `GET/PATCH /api/backoffice/content/pages/[id]` — `scopeOr401` then `requireRoleOr403(ctx, ["superadmin"])`. Unauthenticated → 401; wrong role → 403.
- **Editor AI routes:** All editor-AI routes use the same rule: `scopeOr401` then `requireRoleOr403(ctx, ["superadmin"])`. AI apply paths are protected as strictly as manual edit paths.

## 2. Editor AI routes (all superadmin-only)

| Route | Purpose | Auth |
|-------|---------|------|
| `POST /api/backoffice/ai/suggest` | Suggest (improve, SEO, sections, etc.) | scopeOr401 → requireRoleOr403(superadmin) |
| `POST /api/backoffice/ai/apply` | Log apply to ai_activity_log | scopeOr401 → requireRoleOr403(superadmin) |
| `POST /api/backoffice/ai/block-builder` | Generate block from description | scopeOr401 → requireRoleOr403(superadmin) |
| `POST /api/backoffice/ai/page-builder` | Generate page structure / blocks | scopeOr401 → requireRoleOr403(superadmin) |
| `POST /api/backoffice/ai/screenshot-builder` | Bootstrap blocks from screenshot/description | scopeOr401 → requireRoleOr403(superadmin) |
| `POST /api/backoffice/ai/image-generator` | Generate brand-safe image | scopeOr401 → requireRoleOr403(superadmin) |
| `POST /api/backoffice/ai/image-metadata` | Suggest alt/caption/tags | scopeOr401 → requireRoleOr403(superadmin) |
| `POST /api/backoffice/ai/layout-suggestions` | Layout suggestions from blocks/title | scopeOr401 → requireRoleOr403(superadmin) |
| `POST /api/backoffice/ai/design-suggestion/log-apply` | Log design suggestion apply | scopeOr401 → requireRoleOr403(superadmin) |
| `POST /api/backoffice/ai/seo-intelligence` | SEO intelligence for blocks/meta | scopeOr401 → requireRoleOr403(superadmin) |
| `GET /api/backoffice/ai/capability` | AI enabled flag for editor | scopeOr401 → requireRoleOr403(superadmin) |

Other backoffice AI routes (status, jobs, health, suggestions) remain superadmin-only as before.

## 3. Fail-closed behavior

- **Unauthenticated:** `scopeOr401(req)` returns `{ ok: false, res }`; route returns `res` (401). No session → no access.
- **Wrong role:** `requireRoleOr403(ctx, ["superadmin"])` returns a 403 Response; route returns it. So company_admin or employee calling an editor AI route gets 403.
- **Missing/broken auth:** Routes that use `denyResponse(s)` (e.g. screenshot-builder) or `return gate.res` on `gate.ok === false` ensure that any failed or missing scope yields 401. No silent success.

## 4. No bypass of editor/CMS permissions

- AI suggest returns a patch; apply is done by the client via `PATCH /api/backoffice/content/pages/[id]`, which is already superadmin-only. So AI cannot be used to mutate content without passing the same content API gate.
- Block/page/screenshot builders return data only; the client applies by updating editor state and then saving via the same content PATCH. So apply path = manual edit path.
- Design-suggestion log-apply and `/api/backoffice/ai/apply` only write to `ai_activity_log`; they do not mutate content. They are still gated so only superadmin can log.

## 5. Rules

- No auth architecture rewrite; only verified permission/safety gaps were fixed.
- All editor AI routes that can generate or influence content (or log apply) are superadmin-only, matching content pages and backoffice layout.
- Unauthorized users cannot use privileged editor AI actions (401/403).
- AI apply paths are protected as strictly as manual edit paths.
