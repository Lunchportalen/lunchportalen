# U19 — AI control center governance model

## Komponenter (U18 + U19)

| Del | Innhold |
|-----|---------|
| `AiGovernanceOverview` | Full `MODULE_LIVE_POSTURE_REGISTRY` |
| `AiGovernanceHumanAndCostPanel` | Human approval, kost/leverandør, env-konfig (uten hemmeligheter) |
| `AiControlRunClient` | Eksisterende autonom kjøring (begrenset) |

## Umbraco AI-prinsipper

- CMS stabil, AI modulær/valgfri, review-first, ingen leverandørlås-narrativ som bryter CI.

## Må vente

- Interaktiv modellvelger og live kost-graf i UI.
