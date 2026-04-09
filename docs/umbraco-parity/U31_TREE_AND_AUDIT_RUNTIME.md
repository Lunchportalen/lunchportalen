# U31 — Tree & audit runtime

## Tree
- **Route:** `app/api/backoffice/content/tree/route.ts` — degradable schema; virtual roots; JSON errors serialized.
- **UI:** `ContentTree.tsx` — **U31:** explicit empty-tree operator message when load succeeds with zero nodes (migration hint).

## Audit
- **Route:** `app/api/backoffice/content/audit-log/route.ts` — superadmin; **200 + `degraded: true`** when `content_audit_log` unavailable (no 500 for normal degraded path).
- **Client:** `useContentAuditLogHealth` probes `?limit=1`; **403/401** → no footer warning (no access).
- **Snapshot:** `auditLogDegraded` flows into `ContentBellissimaWorkspaceSnapshot` → footer badge **«Audit: degradert»**.
