# U31 — Workspace context target

## Canonical model
- **Types:** `ContentBellissimaWorkspaceSnapshot` in `lib/cms/backofficeWorkspaceContextModel.ts`.
- **Provider:** `components/backoffice/ContentBellissimaWorkspaceContext.tsx` — **one** React context for editor session snapshot.

## Must live in snapshot (control plane)
- Entity id, document type alias, publish state, canvas mode, save state, dirty.
- **U31:** `auditLogDegraded` optional — from GET `/api/backoffice/content/audit-log?limit=1` when superadmin; `null` = unknown / no access.

## May stay local
- Block selection, modals, panel tab index, DnD — editor UI only.

## Actions on context
- **Publisher:** `useBellissimaWorkspacePublisher()` — only `ContentWorkspace` writes snapshot.

## Consumers
- **Footer:** `BackofficeWorkspaceFooterApps` reads snapshot.
- Future: inspector rails may read snapshot (avoid duplicating props).
