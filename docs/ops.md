# Ops Runbook (Lunchportalen)

## Incident Levels
- P1: Auth/DB/infra down, total funksjonssvikt, ingen innlogging/bestilling mulig
- P2: Delvis funksjonssvikt (kritiske strømmer påvirket, men systemet lever)
- P3: Mindre feil/avvik uten direkte driftspåvirkning

## Første 5 minutter
1) Sjekk helse:
   - `GET /api/health`
   - `GET /api/cron/daily-sanity`
2) Finn rid fra feilmelding/monitorering
3) Søk i logger med rid (korrelasjon)
4) Bekreft om feilen er global eller tenant-spesifikk

## Standardtiltak (prioritert)
1) Restart tjeneste (plattform/vercel/host)
2) Rollback til siste grønne deploy
3) Pause firma (superadmin) ved feil i tenant-spesifikk data

## Hva man ALDRI gjør
- Manuelle unntak eller “midlertidige fixes” i prod
- Direkte DB-endringer (uansett årsak)
- Overstyring av cutoff/forretningsregler

## Logging og sporbarhet
- Alle 5xx skal ha incident-logg med rid
- Kun IDs logges (ingen persondata)
- Rid er primær nøkkel for etterforskning

## DB Index Requirements (prod)
- orders(company_id, date)
- profiles(company_id)
- orders(company_id, location_id, date) hvis lokasjonsfilter brukes
