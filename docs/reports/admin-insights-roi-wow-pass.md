# Admin Insights / ROI WOW Pass

## Files Changed
- app/api/admin/insights/route.ts
- app/admin/insights/AdminInsightsClient.tsx
- app/admin/insights/page.tsx
- AGENTS.md

## KPIs Implemented
- Totalt antall leveringer (periode)
- Antall aktive leveringsdager
- Gjennomsnittlig ordre per dag
- Antall avbestillinger før cut-off
- Antall avvik etter cut-off

## How To Read The Report (5-step)
1. Start med perioden for å se hva tallene gjelder.
2. Sjekk total leveringsmengde og aktive dager for volum og stabilitet.
3. Les av gjennomsnittlig ordre per dag for forutsigbarhet.
4. Se avbestillinger før cut-off for kost/matsvinn-kontroll.
5. Se avvik etter cut-off for driftsrisiko og oppfølging.

## Decisions This Supports
- Bekrefte stabil drift uten overraskelser
- Justere avtaler og volum basert på faktisk bruk
- Redusere avvik ved å følge cut-off rutiner
