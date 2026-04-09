# U26 — Management read model

## Intention

Speiler **Management API-tenkning** som **read-only** over eksisterende registry — ikke ny plattform.

## Surfaces

| Surface | Rolle |
|---------|--------|
| `GET /api/backoffice/content/governance-registry` | JSON for verktøy (superadmin) |
| `/backoffice/settings/management-read` | Menneskelesbar oversikt |

## Ærlighet

- `source: "code_registry"` i API-svar.
- Endring av typer = **deploy**, ikke runtime CRUD.

## Senere (valgfritt)

- Persisted definitions bare med eksplisitt schema-prosjekt — utenfor U26.
