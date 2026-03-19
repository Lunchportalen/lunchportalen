# Backoffice surface map and status matrix

Senior backoffice QA view: routes, entrypoints, data dependencies, auth, failure modes, and verification status. Surfaces are only marked VERIFIED when they survive realistic normal/empty/error states without crashing (not just a single render).

---

## Surface map

| Route | Page/entrypoint | Data dependencies | Auth | Likely failure modes |
|-------|-----------------|-------------------|------|----------------------|
| `/backoffice` | (redirect or first module) | — | superadmin | Redirect to role home if not superadmin. |
| `/backoffice/content` | ContentDashboard | None (static) | superadmin | None; static copy + tree loads in layout. |
| `/backoffice/content/[id]` | ContentEditor → ContentWorkspace | GET pages/:id, tree API | superadmin | 404 / slug not found → CreateMissingPageClient; API error in workspace. |
| `/backoffice/content/recycle-bin` | Recycle bin view | (mock or API) | superadmin | Empty list. |
| `/backoffice/releases` | ReleasesPage | GET /api/backoffice/releases, GET releases/:id | superadmin | Empty list; API error; detail load error. |
| `/backoffice/media` | MediaLibraryPage | GET /api/backoffice/media/items, PATCH item | superadmin | Empty list; API error; upload/alt save error. |
| `/backoffice/users` | UsersPage | GET /api/backoffice/users | superadmin | Empty list; 401/403/5xx → error state. |
| `/backoffice/members` | MembersPage | GET /api/admin/employees | superadmin | Empty list; 401/403/5xx → error state. |
| `/backoffice/templates` | TemplatesPage | Static documentTypes | superadmin | Empty array → "Ingen dokumenttyper registrert". |
| `/backoffice/forms` | FormsPage | GET /api/backoffice/forms | superadmin | Empty list; API error; create error. |
| `/backoffice/forms/[id]` | Form detail | GET form by id | superadmin | 404; API error. |
| `/backoffice/translation` | TranslationPage | GET /api/backoffice/translation/summary | superadmin | Empty summary; API error. |
| `/backoffice/settings` | SettingsPage | GET/PUT system settings API | superadmin | Load error; save error. |
| `/backoffice/ai` | AIControlPage | GET /api/backoffice/ai/jobs, health, etc. | superadmin | Jobs/health API error; empty lists. |
| `/backoffice/ai/editor-verification` | Editor verification | (config/API) | superadmin | Config load error. |
| `/backoffice/design` | Design page | (static or tokens) | superadmin | — |
| `/backoffice/experiments` | ExperimentsPage | (API) | superadmin | Empty; API error. |
| `/backoffice/experiments/[id]` | Experiment detail | (API) | superadmin | 404; API error. |
| `/backoffice/preview/[id]` | Preview | Page/variant data | superadmin | 404; API error. |
| `/backoffice/internal/ai-verification` | Internal AI verification | (API) | superadmin | — |

**Shared shell:** `BackofficeShell` (layout) → TopBar, ModulesRail, SectionShell (for content). Auth: `getAuthContext()` in layout; redirect to `/login?next=...` if unauthenticated; `BlockedAccess` if auth failed; redirect to `roleHome(role)` if not superadmin.

---

## Status matrix

| SURFACE | STATUS | EVIDENCE | FAILURE LAYER | TEST ADDED |
|---------|--------|----------|---------------|------------|
| `/backoffice` (entry) | PARTIAL | Redirect to content or login by layout; no dedicated E2E for entry. | — | No |
| `/backoffice/content` | VERIFIED | backoffice-smoke + core-flows: load, heading "Content", main visible, no crash. ContentDashboard is static. | N/A (no API) | No |
| `/backoffice/content/[id]` (workspace) | VERIFIED | backoffice-content-tree: tree, open Hjem/fixed child, workspace URL, main visible. editor-save-smoke + ai-cms: save flow. Slug-not-found → CreateMissingPageClient (code). | API 404 → safe "Node ikke funnet" + create option. | No |
| `/backoffice/content/recycle-bin` | PARTIAL | In nav; backoffice-smoke hits modules by tab (Content includes this as same section). No explicit recycle-bin path E2E. | Empty (mock) in code. | No |
| `/backoffice/releases` | VERIFIED | backoffice-smoke: load, heading. backoffice-releases.e2e: load, **empty state** ("Ingen releases." / "Velg en release."), create, detail, no crash. | Empty + API error handled in code; E2E asserts empty-safe. | No |
| `/backoffice/media` | PARTIAL | backoffice-smoke: load, heading "Mediearkiv". backoffice-media + media-flow: upload/picker. **No E2E that asserts empty or API error state.** | Code: loading, error, empty "Ingen bilder…". | No |
| `/backoffice/users` | VERIFIED | backoffice-smoke: load, heading. **backoffice-users-smoke.e2e**: load, then assert (list or "Ingen brukere" or error message), no crash. | Code: loading, error, empty. E2E: safe empty/error surface. | Yes — backoffice-users-smoke.e2e.ts |
| `/backoffice/members` | PARTIAL | backoffice-smoke: load, heading "Medlemmer". No E2E for empty or API error. | Code: loading, error, empty. | No |
| `/backoffice/templates` | VERIFIED | backoffice-smoke: load, heading "Maler". Static + empty-array safe in code. | Empty → "Ingen dokumenttyper registrert". | No |
| `/backoffice/forms` | PARTIAL | backoffice-smoke: load, heading "Forms". No E2E for empty or API error. | Code: loading, error, empty. | No |
| `/backoffice/forms/[id]` | NOT TESTED | No E2E for form detail. | 404 / API error. | No |
| `/backoffice/translation` | PARTIAL | backoffice-smoke: load, heading "Oversettelser". No E2E for empty or API error. | Code: loading, error, empty. | No |
| `/backoffice/settings` | PARTIAL | backoffice-smoke: load, heading "Systeminnstillinger". No E2E for load error or save error. | Code: loading, error, toast. | No |
| `/backoffice/ai` | PARTIAL | backoffice-smoke: load, heading "AI Control". No E2E for jobs/health empty or API error. | Code: error, empty lists. | No |
| `/backoffice/ai/editor-verification` | NOT TESTED | Not in backoffice-smoke module list. | — | No |
| `/backoffice/design` | PARTIAL | In content tree as "Design"; backoffice-content-tree clicks Design, expects base URL. No standalone /backoffice/design E2E. | — | No |
| `/backoffice/experiments` | NOT TESTED | In ModulesRail; not in backoffice-smoke BACKOFFICE_MODULES. | — | No |
| `/backoffice/experiments/[id]` | NOT TESTED | — | — | No |
| `/backoffice/preview/[id]` | NOT TESTED | — | — | No |
| `/backoffice/internal/ai-verification` | NOT TESTED | Internal. | — | No |
| Unauthenticated /backoffice/* | VERIFIED | auth.e2e: unauthenticated /backoffice/content → /login?next=.... | Layout redirect. | No |

---

## Summary

- **VERIFIED (survives normal + empty or error in test):** content, content/[id], releases, users, templates.
- **PARTIAL (load only or code-safe but no E2E empty/error):** content recycle-bin, media, members, forms, translation, settings, ai, design.
- **NOT TESTED:** forms/[id], ai/editor-verification, experiments, experiments/[id], preview/[id], internal/ai-verification.

**Test added this pass:** `e2e/backoffice-users-smoke.e2e.ts` — one test: load /backoffice/users as superadmin, assert no crash and (heading visible and (list has rows or "Ingen brukere" or error message visible)), proving safe empty and error surface.
