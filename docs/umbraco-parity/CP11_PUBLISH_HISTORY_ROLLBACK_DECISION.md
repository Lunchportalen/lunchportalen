# CP11 — Publish / history / rollback decision

**Dato:** 2026-03-29  
**Referanse:** `CP9_PUBLISH_HISTORY_ROLLBACK_CONTRACT.md`, `CP10_PUBLISH_HISTORY_ROLLBACK_PLAN.md`.

## Save / preview / publish

| Spor | Sannhet |
|------|---------|
| Postgres-sider | Workspace + workflow publish API |
| Meny (`menuContent`) | Sanity + broker — dokumentert kjede |
| `weekPlan` | Redaksjonelt — **LIMITED** vs operativ uke |

## Governance / schedule

- Eksisterende cron + releases der implementert — **ikke** Umbraco Scheduler-klon.

## History / versioning

| Kilde | Full paritet i LP | Merknad |
|-------|-------------------|---------|
| Postgres | Recovery der API finnes | — |
| Sanity | Studio history | Hovedsakelig utenfor LP-UI |
| **Samlet tidslinje** | **Nei** | Ikke forfalsket i CP11 |

## Rollback-fortelling

- Der recovery finnes: bruk eksisterende UI/API.
- Der ikke: **tydelig tekst** — CP11 legger inn valgfri **surface-notis**, ikke fake data.

## CP11 bygger

- **Konsistent workspace-språk** om draft/published der allerede tilgjengelig i respektive flater.
- **Ingen** ny historikkmotor.

## Ikke forfalske

- Global «undo» for alle domener.
- Versjonsnummer som ikke finnes i backend.
