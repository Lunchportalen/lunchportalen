# U23 — Content type filters og creation flow

## Regler i dag (der de lever)

1. **Undernoder i tre**: `allowedChildTypes` settes fra lasting av forelders dokumenttype / API — workspace viser kun **tillatte alias** i create panel. Tom liste → melding om å velge forelder eller at forelder ikke tillater barn.
2. **Envelope**: Side lagrer `documentType` i body-envelope; bytte av type i UI kan tømme envelope-felt (eksisterende oppførsel i properties rail).
3. **Blokker**: Alle typer i `BlockAddModal` er i prinsippet tilgjengelige for sidens body — **ingen** tree-basert filter per blokktype (til forskjell fra Umbracos allowed blocks på document type).

## Implisitte vs synlige
- **Eksplisitt i UI**: create panel-liste, blokkmodal.
- **Implisitt**: at kun `page` finnes som document type; at enterprise renderer forventer **registry**-mapper (`blockTypeMap.ts`) for legacy typer.

## Umbraco content type filters — speiling
- **Tillatte barn**: delvis speilet via `allowedChildren` og API.
- **Tillatte blokktyper per document type**: **ikke** fullt implementert — ville kreve policy i envelope eller server validation (ikke bygget i U23).

## Kan bygges nå
- **Dokumentert** matrix på `/backoffice/settings/create-options`: hva som filtreres hvor (honest).
- **Ingen** ny policy-motor.

## Må vente
- Per-document-type **block allowlist** med server enforcement.
