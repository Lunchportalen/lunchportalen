# E0 — Scale confidence (arbeidsstrøm 5)

**Dato:** 2026-03-29

## Bevist

- **Enhetstester + integrasjonstester** (Vitest) — logikk og mange API-baner.
- **build:enterprise** — statisk og script-gates.

## Ikke bevist

- **Lasttest** mot definert målark (samtidige brukere, ordre/min, DB-pool) — `OPEN_PLATFORM_RISKS` F1.
- **Langvarig** produksjonsdrift under pigg — F2 (tunge synkrone API-er).

## Klassifisering (ærlig)

| Nivå | Betydning |
|------|-----------|
| Pilot scale | Støttet av dagens tester og pilot-QA |
| Narrow broad-live scale | Mulig med kontrollert trafikk — **antakelse**, ikke bevis |
| Long-term enterprise scale | **NOT_PROVED** |

## Konsekvens for E0

Ubetinget enterprise-live krever **ikke** nødvendigvis 50k×200-bevis, men krever at vi **ikke** påstår skala uten bevis. Siden bevis **mangler**, er påstand om ubetinget enterprise-scale **uærlig** → **NO-GO** for unconditional closure.
