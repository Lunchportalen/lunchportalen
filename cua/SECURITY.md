# Security policy

## Støtte

Dette er et lite internt verktøy for sammenslåing av JSON-policyfiler på disk. Det har **ingen** nettverksflate, autentisering eller database.

## Rapportering

Mistenker du et sikkerhetsproblem som påvirker dette verktøyet eller dets bruk i monorepoet, rapporter til prosjektets interne vedlikeholdere (samme kanal som øvrige Lunchportalen-sikkerhetshenvendelser). Inkluder repro-trinn og påvirket versjon.

## Trygg bruk

- Ikke legg hemmeligheter i JSON som logges; logger bruker filnavn og baner.
- Kjør kun mot kataloger du stoler på; verktøyet leser og skriver filer som beskrevet i README.
