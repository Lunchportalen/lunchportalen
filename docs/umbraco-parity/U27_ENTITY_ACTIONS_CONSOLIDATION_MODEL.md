# U27 — Entity actions consolidation model

## Hvor handlinger finnes i dag

| Flate | Eksempler | Konsistens |
|-------|-----------|------------|
| Trees | `NodeActionsMenu` — CRUD-lignende, preview, flytt | God; kontekstmeny |
| Discovery / palette | Navigasjon til entitet | Variabel etter kilde |
| Workspace headers | Lagre, publiser, forhåndsvis, AI | Sterk innen content |
| Collection views | «Åpne» / «Forbedre» med `text-pink` underline | Gjentar mønster |
| Domain / runtime | Egne kontrolltårn | Modulære |

## Hva som føles tilfeldig

- Noen flater bruker knapp vs bare `Link` med underline.
- «Preview» vs «Forhåndsvis» vs «Åpne i redigerer» — samme intensjon, ulikt verb.

## U27-standardisering (minimal)

- **Primær navigasjon til redigering:** pink underline + `font-semibold` (eksisterende tailwind-mønster).
- **Trygg bulk:** alltid eksplisitt «kun utklippstavle» / «ingen lagring» der relevant.
- **Ingen ny manifest-motor** — dokumentasjon + små UI-justeringer der det ikke rokker frozen flows.

## Anbefalt kategorisering (visuelt/tekst)

- **Vis/rediger:** åpne workspace.
- **Forhåndsvis:** offentlig/preview-URL der den finnes.
- **Publiser:** eksplisitt i workflow — ikke dupliser i collection uten kontekst.
- **Review:** governance/legacy-lister.
- **Runtime routing:** til orders/kitchen/driver via eksisterende lenker — ikke flytt sannhet.
