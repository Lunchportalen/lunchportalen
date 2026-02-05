# Company Lifecycle (RC)

## Archive → Restore
- Archive: Superadmin arkiverer firma (all tilgang fjernes, historikk beholdes).
- Restore: Superadmin gjenoppretter firma uten brukere.
- Ny onboarding er alltid påkrevd etter restore.
- Ingen automatisk reaktivering av brukere eller tidligere tilganger.

## Audit (Obligatorisk)
- Arkiver firma → audit_event
- Gjenopprett firma → audit_event
- Generer fakturagrunnlag → audit_event
- ESG-sammendrag → audit_event
- Audit feiler = handling feiler (fail-closed).

## Fakturagrunnlag (Read-only)
- Basert på historiske, leverte ordre.
- Summeres på `orders.unit_price` (snapshot).
- Hvis `unit_price` mangler → `ok:true` + warning "Manglende pris-snapshot".
- Breakdown per dag og per uke.
- CSV eksport er read-only.

## ESG (Historisk)
- Basert på faktisk ordredata.
- Leveranser = antall ordre med status `DELIVERED`.
- Avbestillinger i tide = status `CANCELLED/CANCELED` før 08:00 Oslo (samme leveringsdato).
- Estimert spart porsjoner = avbestillinger i tide.
- Kommentar: “Basert på faktisk ordredata”.

## NO-EXCEPTION-RULE
- Ingen automatikk etter arkivering.
- Ingen gjenoppretting av brukere.
- Ingen endring av historikk.
- All audit må være sporbar via RID.
