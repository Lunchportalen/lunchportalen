# U30 — Tree & audit runtime failures

## Terminal / drift (brief)

| Symptom | Sannsynlig årsak | Retning |
|---------|------------------|---------|
| `GET /api/backoffice/content/tree` → tomt / forventet ikke | 403 ikke-superadmin; manglende `content_pages`/kolonner; `ok:false` uten `data` | Klient: tydelig 403/401-kopi; API: allerede `emptyRoots` ved manglende tabell |
| `GET /api/backoffice/content/audit-log` → 500 `AUDIT_LOG_FAILED` | Tabell `content_audit_log` finnes ikke i miljøet, eller schema-feil | API: degradert 200 + tom `items` + `degraded` (ikke skjul bak 500) |

## Hvorfor tree oppleves «ustabilt»

- Backoffice content-API er **superadmin-gated** (designvalg). Ikke-superadmin får 403 → tomt tre + generisk feil uten forklaring.
- Manglende migrasjon: tree returnerer allerede virtuelle røtter ved `42P01`; klient må vise at data kan mangle.

## Hvorfor audit/history oppleves ubrukelig

- 500 ved manglende tabell gir tomt panel og generisk feil — redaktør ser ikke *hvorfor*.
- UI antok `ok && items` — må tåle `degraded: true`.

## Kode som må inn (U30)

1. `app/api/backoffice/content/audit-log/route.ts` — graceful degradation ved manglende tabell/relation.
2. `EditorialAuditTimelinePanel.tsx` — vis ærlig degradert tilstand.
3. `ContentTree.tsx` — spesifikk melding for HTTP 401/403 ved tree-fetch.
