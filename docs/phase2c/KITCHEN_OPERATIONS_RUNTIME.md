# Kitchen — operative handlinger (2C2 runtime)

## Lesing (aktiv)

| Handling | Sted | API |
|----------|------|-----|
| Last produksjonsliste per dato | Produksjonsliste-fane | `GET /api/kitchen` |
| Last aggregert rapport dag/uke | Aggregert fane | `GET /api/kitchen/report` |
| CSV for rapport | Aggregert fane | `GET /api/kitchen/report.csv` |
| Prognose (beslutningsstøtte) | Aggregert fane | `GET /api/kitchen/demand-forecast` |
| Utskrift | Nettleser print | Eksisterende print-stiler på side |

## Mutasjoner

- **Ingen nye** kjøkken-mutasjoner i 2C2.  
- Flatene forblir **read-first** med hensyn til ordre/bestilling.  
- Eksisterende batch-/print-/cron-flyter som **ikke** er endret i denne fasen — se egne ruter og `docs/phase2c/KITCHEN_RUNTIME_PLAN.md` for risiko.

## Bevisst utsatt

| Ønsket handling | Status |
|-----------------|--------|
| Status «ferdig / packa» per batch fra denne flaten | Krever egen backend-kontrakt + idempotens — **ikke** levert i 2C2 |
| Redigere ordre/notat fra kjøkken | Ordre-sannhet ligger hos eksisterende domene — **ikke** åpnet her |

## Hva som må til før flere mutasjoner

1. Eksplisitt produkt-API for kjøkken (hvilke felt, hvilke roller, audit).  
2. Idempotens og tester per endepunkt.  
3. Ingen overlapp med employee order-/uke-flyt uten egen PR.
