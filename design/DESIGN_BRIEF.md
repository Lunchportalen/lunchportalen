# Lunchportalen — Design Brief (v1)

## Mål
Bygge et rolig, enterprise “command center” for firmakunder og superadmin.
UI skal føles: kontrollert, forutsigbart, dyrt og uten støy.

## Prinsipper (låst)
- No-exception rule (ingen manuelle unntak i UI)
- Én sannhetskilde: portaldata er fasit
- Admin styrer rammer, ansatte styrer daglige valg
- Fail-closed: aldri “stille feil”

## Navigasjon / IA (kort)
- Admin: Dashboard, Avtale, Ansatte, Insights, Historikk, Lokasjoner
- Ansatt: Uke, Bestilling, Historikk
- Superadmin: Firma, Avtaler, Drift, Logs

## Visuell stil
- Typografi: system-ui (Inter/Manrope OK)
- Kort: avrundet, diskret skygge, luftige margins
- CTA: tydelig, høy kontrast
- Status: chips/badges for ACTIVE/PENDING/PAUSED/CLOSED
- Ingen overdrevent fargerot (neon kun der det er definert)

## Komponenter som prioriteres
- Tabs/pills for admin-seksjoner
- KPI-kort (3-5) med klare labels
- Tabeller med sticky header + søk
- Dialoger for bekreftelse (idempotent handlinger)

## Done-kriterier
- Ingen horisontal scroll på mobil
- Konsekvent spacing/typografi i hele admin
- Alle actions har tydelig status/kvittering (rid + tidspunkt)
