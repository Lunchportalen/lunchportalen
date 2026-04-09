# U30X — Runtime failures from logs (backoffice)

**Evidence:** Implementasjonskode + tester (`tests/api/treeRouteDegradable.test.ts`, `contentAuditLogRoute.test.ts`). Faktisk terminal fra bruker er ikke vedlagt.

## Observert / forventet feil (før fiks)

| Rute | Problem | Alvorlighet |
|------|---------|-------------|
| `GET /api/backoffice/content/tree` | Schema mismatch / ukjent kolonne → 500 | Høy |
| `GET /api/backoffice/content/tree` | `isMissingTableError` matchet **enhver** `does not exist` → feil «tom tabell»-gren | Høy (feilklassifisering) |
| `GET /api/backoffice/content/audit-log` | Manglende tabell / cache | Middels — skal være 200 degradert |

## Schema mismatch

- **page_key:** Håndteres allerede med legacy select + inferens (`contentTreePageKey.ts`).
- **Andre kolonner / cache:** Nå degradert til virtuelle røtter + `reason: SCHEMA_OR_CACHE_UNAVAILABLE` via `isTreeRouteDegradableSchemaError`.

## Trygt vs ærlig degradert

- **Trygt fikset:** Skill «kolonne mangler» fra «relasjon mangler» i `isMissingTableError`.
- **Ærlig degradert:** Tree uten sider men med virtuelle mapper; `content_audit_log` tom liste med `degraded: true` (eksisterende mønster, utvidet klassifisering).

## Mest kritisk for editoren

1. Tree må laste uten 500 ved delvis migrert DB.
2. Audit-tidslinje må ikke knekke siden når tabell mangler (allerede panel — forbedret backend-klassifisering).
