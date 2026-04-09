# CP12 — Unified history contract

**Dato:** 2026-03-29

## Save / preview / publish

| Domene | Lagring | Preview/publish |
|--------|---------|-----------------|
| Postgres-sider | Content workspace API | Workflow + variant publish |
| Sanity meny | Studio + broker | Eksisterende publish-kjede |
| Media | Media API | Direkte på entitet |

## Governance / schedule

- Cron/releases som før — ikke én Umbraco Scheduler-klon.

## History / versioning — lag

| Område | Historikk-lag | Dybde |
|--------|----------------|-------|
| Postgres innhold | Recovery/konflikt der implementert | Delvis i LP-UI |
| Sanity | Studio history | Full i Studio, ikke speilet 1:1 i LP |
| Media | Versjon per medium / metadata | Per API |
| Ordre/billing | Runtime audit | **Ikke** CMS-historikk |

## Delvis historikk

- «Unified» i LP = **fortelling + lenker**, ikke én merged `history_events`-tabell for alt.

## CP12 UX-lag

- **`CmsHistoryDiscoveryStrip`**: forklarer **hvor** man finner sporbarhet — **ingen** falsk samlet logg.

## Rollback-fortelling

- Der API finnes: eksisterende knapper/flows.
- Der ikke: **tydelig** i strip og i workspace — ikke «rollback overalt».

## Ikke forfalske

- Én tidslinje-API som blander kilder uten kildehenvisning.
