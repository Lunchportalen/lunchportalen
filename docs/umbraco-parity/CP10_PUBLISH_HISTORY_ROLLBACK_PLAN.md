# CP10 — Publish / history / rollback plan

**Dato:** 2026-03-29  
**Referanse:** `CP9_PUBLISH_HISTORY_ROLLBACK_CONTRACT.md` (fortsatt gyldig sannhet).

## Save

| Domene | Sannhet |
|--------|---------|
| Postgres-sider | Workspace-lagring (eksisterende API) |
| Sanity (meny) | Studio + broker; draft→published der dokumentert |

## Preview

- Preview-lenker for sider i content workspace; meny filter i GROQ — **ikke** slått sammen til én teknisk preview-motor.

## Publish

- **Sider:** workflow publish (eksisterende ruter).
- **Meny:** én Sanity-kilde; ingen ny menymotor.

## Governance / schedule

- Cron + workflow i drift — **ikke** Umbraco Scheduler-klon i LP.

## History / versioning

| Område | Full paritet | Simulert / delt |
|--------|--------------|-----------------|
| Postgres sider | Recovery der implementert | — |
| Sanity meny | Studio history | Ikke fullt innebygd i LP |
| **Fortelling** | Vis hvor historikk lever | **Ikke** late som én DB |

## Rollback-fortelling

- **Der API finnes:** bruk eksisterende recovery/publish flows.
- **Der API ikke finnes:** **UI må ikke** påstå full rollback; bruk **tekst/lenke** til Studio eller manuell prosess.

## CP10 bygger

- **Klarhet** i docs + UI der allerede mulig (eksisterende statuspaneler).
- **Ikke** ny parallell historikkmotor.

## Hva som ikke skal forfalskes

- En **samlet tidslinje** som blander kilder uten sporbarhet.
- **Rollback** uten idempotent, sikker backend-endpoint.
