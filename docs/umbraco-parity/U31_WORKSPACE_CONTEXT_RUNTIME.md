# U31 — Workspace context runtime

- **Types:** `lib/cms/backofficeWorkspaceContextModel.ts` — `ContentBellissimaWorkspaceSnapshot` includes `auditLogDegraded: boolean | null`.
- **Provider:** `ContentBellissimaWorkspaceProvider` in content layout.
- **Writer:** `ContentWorkspace.tsx` — `buildContentBellissimaWorkspaceSnapshot({ ..., auditLogDegraded })` on page load.
- **Readers:** `BackofficeWorkspaceFooterApps` (status + governance links + preview link).
