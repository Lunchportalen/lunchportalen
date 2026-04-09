# U30R — Tree & audit runtime failures (log)

| Logg | Årsak | Fiks |
|------|-------|------|
| `column content_pages.page_key does not exist` | Migrasjon ikke kjørt | `GET /tree` prøver full select, faller tilbake uten `page_key` + slug-inferens; migrasjon `20260330120000_*` |
| `content_audit_log` schema cache / mangler | Tabell/migrasjon | `isAuditLogTableUnavailableError` i `lib/cms/auditLogTableError.ts` + 200 degradert |
