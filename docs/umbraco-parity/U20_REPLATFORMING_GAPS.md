# U20 — Replatforming gaps

| Krav | Kan simuleres på Next/Supabase? | Anbefaling |
|------|-----------------------------------|------------|
| Én distribuert innholds-cache som Umbraco Distributed Cache | Delvis (CDN, ISR) | Dokumenter forskjell; ikke fake i CMS-UI |
| Global Management API med full CRUD-paritet | Nei 1:1 | Eksisterende `app/api/backoffice/*` er sann API — UX-paritet |
| Umbraco Content Delivery API | Delvis | Public `getContentBySlug` + API — egen roadmap |
| «Ekte» én historikkmotor på tvers av Sanity + Postgres + runtime | Nei uten event store | **UX-aggregator** med kildebadges (U20) |
| UI for modellvalg/nøkkelrotasjon uten deploy | Krever sikker policy-lag | **REPLATFORMING_GAP** — U20 viser read-only status |

## Forsvarlig på dagens stack

- Discovery bundle, audit read API, AI status panel, ærlige strips.
