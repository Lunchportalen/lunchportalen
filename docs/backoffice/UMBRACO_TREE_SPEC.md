# Umbraco / Beyond backoffice — Tree spec (fasit)

Dette dokumentet er **ground truth** for hva et komplett Umbraco-lignende backoffice tre skal inneholde. Alle required route files og UI-moduler er listet per node.

Base path: `app/(backoffice)/backoffice/`

---

## 1) Shell

Topbar, Tabs, ModulesRail, SectionShell, TreePanel, Workspace.

| Node | Required route files (page/layout) | Required UI modules |
|------|------------------------------------|----------------------|
| Root shell | `layout.tsx` | Topbar, Tabs, tenant switcher |
| SectionShell | (per section) | ModulesRail (left), TreePanel (left), Workspace (main) |

- **Required route files**: `app/(backoffice)/backoffice/layout.tsx`
- **Required UI modules**: Topbar, RoleTabs/ModuleTabs, ModulesRail, SectionShell, TreePanel, Workspace container

---

## 2) Content

Home / Global / Design / RecycleBin + routes + tree/workspace/api.

| Node | Required route files (page/layout) | Required UI modules |
|------|------------------------------------|----------------------|
| Content root | `content/page.tsx` eller `content/layout.tsx` + default page | Content tree, workspace |
| Content tree | (client under content) | TreePanel (nodes: Home, Global, Design, RecycleBin) |
| Content workspace | (client under content) | Workspace (editor, list view) |
| API | `app/api/backoffice/content/**` | — |

- **Required route files**: `app/(backoffice)/backoffice/content/page.tsx` (eller `content/layout.tsx` + segment page), `content/[[...slug]]/page.tsx` (optional for deep routes)
- **Required UI modules**: ContentWorkspace, Content tree, list/detail views, RecycleBin view

---

## 3) Media

Root / folders / files / recycle + routes + tree/workspace/api.

| Node | Required route files (page/layout) | Required UI modules |
|------|------------------------------------|----------------------|
| Media root | `media/page.tsx` eller `media/layout.tsx` | Media tree, workspace |
| Media tree | (client under media) | TreePanel (folders, files, recycle) |
| Media workspace | (client under media) | Grid/list view, upload, preview |
| API | `app/api/backoffice/media/**` | — |

- **Required route files**: `app/(backoffice)/backoffice/media/page.tsx`, `media/[[...path]]/page.tsx` (optional)
- **Required UI modules**: MediaTree, MediaWorkspace, upload, recycle

---

## 4) Settings

Doc types, Data types, Templates, Languages, Dictionary + routes/tree/api.

| Node | Required route files (page/layout) | Required UI modules |
|------|------------------------------------|----------------------|
| Settings root | `settings/page.tsx` eller `settings/layout.tsx` | Settings tree |
| Doc types | `settings/doctypes/page.tsx` (eller tree + workspace) | Doc type editor/list |
| Data types | `settings/datatypes/page.tsx` | Data type editor/list |
| Templates | `settings/templates/page.tsx` | Template editor/list |
| Languages | `settings/languages/page.tsx` | Language list/editor |
| Dictionary | `settings/dictionary/page.tsx` | Dictionary editor |
| API | `app/api/backoffice/settings/**` | — |

- **Required route files**: `app/(backoffice)/backoffice/settings/layout.tsx`, `settings/page.tsx`, `settings/doctypes/page.tsx`, `settings/datatypes/page.tsx`, `settings/templates/page.tsx`, `settings/languages/page.tsx`, `settings/dictionary/page.tsx`
- **Required UI modules**: Settings tree, per-section editor/list modules

---

## 5) Users

List / edit / groups + routes/api.

| Node | Required route files (page/layout) | Required UI modules |
|------|------------------------------------|----------------------|
| Users list | `users/page.tsx` | User list, filters |
| User edit | `users/[id]/page.tsx` | User editor |
| User groups | `users/groups/page.tsx` | Groups list/editor |
| API | `app/api/backoffice/users/**` | — |

- **Required route files**: `app/(backoffice)/backoffice/users/page.tsx`, `users/[id]/page.tsx`, `users/groups/page.tsx`
- **Required UI modules**: UserList, UserEditor, UserGroups

---

## 6) Members

List / edit / groups + routes/api.

| Node | Required route files (page/layout) | Required UI modules |
|------|------------------------------------|----------------------|
| Members list | `members/page.tsx` | Member list, filters |
| Member edit | `members/[id]/page.tsx` | Member editor |
| Member groups | `members/groups/page.tsx` | Groups list/editor |
| API | `app/api/backoffice/members/**` | — |

- **Required route files**: `app/(backoffice)/backoffice/members/page.tsx`, `members/[id]/page.tsx`, `members/groups/page.tsx`
- **Required UI modules**: MemberList, MemberEditor, MemberGroups

---

## 7) Templates

Section + tree + editor + routes/api.

| Node | Required route files (page/layout) | Required UI modules |
|------|------------------------------------|----------------------|
| Templates root | `templates/page.tsx` eller `templates/layout.tsx` | Template tree, editor |
| Template editor | `templates/[id]/page.tsx` (optional) | Template editor |
| API | `app/api/backoffice/templates/**` | — |

- **Required route files**: `app/(backoffice)/backoffice/templates/page.tsx`, `templates/[id]/page.tsx` (optional)
- **Required UI modules**: TemplateTree, TemplateEditor

---

## 8) System

Search, Notifications, Audit, Health/SystemStatus + routes/api.

| Node | Required route files (page/layout) | Required UI modules |
|------|------------------------------------|----------------------|
| Search | `system/search/page.tsx` eller `search/page.tsx` | Search UI, results |
| Notifications | `system/notifications/page.tsx` | Notifications list |
| Audit | `system/audit/page.tsx` | Audit log viewer |
| Health / SystemStatus | `system/health/page.tsx` eller `system/status/page.tsx` | Health dashboard |
| API | `app/api/backoffice/system/**`, `app/api/backoffice/search/**` | — |

- **Required route files**: `app/(backoffice)/backoffice/system/search/page.tsx` (eller `search/page.tsx`), `system/notifications/page.tsx`, `system/audit/page.tsx`, `system/health/page.tsx` (eller `system/status/page.tsx`)
- **Required UI modules**: SearchPanel, NotificationsList, AuditLogViewer, HealthStatusView

---

## Route file checklist (for inventory/gap report)

Følgende filer er **required** i henhold til denne spec:

```
app/(backoffice)/backoffice/layout.tsx
app/(backoffice)/backoffice/content/page.tsx
app/(backoffice)/backoffice/content/layout.tsx
app/(backoffice)/backoffice/media/page.tsx
app/(backoffice)/backoffice/media/layout.tsx
app/(backoffice)/backoffice/settings/layout.tsx
app/(backoffice)/backoffice/settings/page.tsx
app/(backoffice)/backoffice/settings/doctypes/page.tsx
app/(backoffice)/backoffice/settings/datatypes/page.tsx
app/(backoffice)/backoffice/settings/templates/page.tsx
app/(backoffice)/backoffice/settings/languages/page.tsx
app/(backoffice)/backoffice/settings/dictionary/page.tsx
app/(backoffice)/backoffice/users/page.tsx
app/(backoffice)/backoffice/users/[id]/page.tsx
app/(backoffice)/backoffice/users/groups/page.tsx
app/(backoffice)/backoffice/members/page.tsx
app/(backoffice)/backoffice/members/[id]/page.tsx
app/(backoffice)/backoffice/members/groups/page.tsx
app/(backoffice)/backoffice/templates/page.tsx
app/(backoffice)/backoffice/templates/[id]/page.tsx
app/(backoffice)/backoffice/system/search/page.tsx
app/(backoffice)/backoffice/system/notifications/page.tsx
app/(backoffice)/backoffice/system/audit/page.tsx
app/(backoffice)/backoffice/system/health/page.tsx
```

Minimal set (kun layout + content root for MVP): `layout.tsx`, `content/page.tsx` (eller content layout + page).
