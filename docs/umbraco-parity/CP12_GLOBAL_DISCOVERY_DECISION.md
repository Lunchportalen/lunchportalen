# CP12 — Global discovery decision

**Dato:** 2026-03-29

## Hva som finnes i dag

| Mekanisme | Omfang |
|-----------|--------|
| **Palett** | `BACKOFFICE_PALETTE_ITEMS` = nav + CP12-extras; klientfiltrering |
| **Content tree** | Klient-søk i tre (CP9) |
| **Media** | Egen liste/query-felt på siden |
| **Growth** | Egne klientflater |

## Merkbare gap

- Ingen **én boks** som søker i alle entitetstyper.
- Ingen **server-side** fulltext uten ny indeks.

## CP12-beslutning

| Spørsmål | Beslutning |
|----------|------------|
| Trygg global discovery over eksisterende data? | **Ja, begrenset:** flere **statiske hurtiglenker** i paletten (samme mønster som nav). |
| Utvidet command palette? | **Ja** — `BACKOFFICE_DISCOVERY_EXTRAS`; **ikke** ny parallell flate. |
| Workspace-nær søk? | **Uendret** der det finnes (tree, media); ikke ny motor. |
| Kontekstuelle quick actions? | **Ikke** nye muterende actions i paletten — kun navigasjon. |

## Kan bygges nå uten indeks

- Flere **dedupliserte** `href` i `BACKOFFICE_DISCOVERY_EXTRAS` (forsiktig — unngå støy).

## Må vente

- Ekte **global søk** / felles indeks.
- Palett-handlinger som kaller **POST** uten eksplisitt sikker kontrakt.
