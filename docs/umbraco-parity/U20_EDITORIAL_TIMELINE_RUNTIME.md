# U20 — Editorial timeline runtime

## Endepunkt

- `GET /api/backoffice/content/audit-log?limit=30&page_id=<uuid>` (superadmin, valgfri filter)
  - `data.items[]` — `id, page_id, variant_id, environment, locale, action, actor_email, metadata` (trimmet), `created_at`
  - `data.source` — `postgres_content_audit_log`

## UI

- `EditorialAuditTimelinePanel` (klient) i `CmsHistoryDiscoveryStrip` — viser siste hendelser med **kilde-badge**.
- Eksplisitt disclaimer: ikke Sanity eller operativ uke-logg.
