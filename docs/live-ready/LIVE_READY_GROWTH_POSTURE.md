# LIVE READY — Growth posture (Social / SEO / ESG) (arbeidsstrøm 4)

**Dato:** 2026-03-29

## Klassifisering

| Flate | Posture | Kommentar |
|-------|---------|-----------|
| Social kalender (DB) | **LIVE** | Intern sannhet |
| Social ekstern publish | **DRY_RUN** / **LIMITED** | Avhenger av kanal-nøkler; API kan returnere `PUBLISH_DRY_RUN` |
| SEO growth | **LIMITED** | «Review først» i UI; ingen auto-live uten lagring |
| ESG visning | **LIVE** (data fra DB) | Tom data — se narrativ |
| ESG estimater | **LIMITED** | Merket som estimater der relevant |

## UI-ærlighet (denne leveransen)

- **Social:** Ekstra hjelpetekst i `SocialCalendarRuntimeClient.tsx` om **dry-run** / manglende nøkler.

## Greenwashing

- **Ikke** tillatt: markedsføre full ekstern reach uten bevis.
- ESG: følg `OPEN_PLATFORM_RISKS` D3 — tom data.

## Ingen nye features

- Ingen nye growth-endepunkter lagt til.
