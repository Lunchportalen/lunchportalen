# U20 — AI settings and governance model

## AI-flater i dag

| Flate | Modenhet |
|-------|----------|
| `/backoffice/ai-control` | Primær governance-hub |
| `AiGovernanceOverview` | Leser `MODULE_LIVE_POSTURE_REGISTRY` |
| `AiGovernanceHumanAndCostPanel` | Forklaring — human approval, kost, env |
| `AiControlRunClient` | Kontrollert kjøring |
| Content workspace AI-paneler | Kontekstuelle, modulavhengige |

## Posture (MODULE_LIVE_POSTURE_REGISTRY)

- **LIVE / LIMITED / DRY_RUN / STUB / INTERNAL_ONLY** — uendret sannhet; UI skal speile registeret.

## Konfigflater

- **Hemmeligheter:** kun server env — aldri klient.
- **U20:** `GET /api/backoffice/ai/status` eksponerer **allerede** `enabled`, `provider`, `model`, `errorCode`, `pos` (uten nøkler) — brukes i **AI settings panel** for lesbar status.

## Umbraco AI-prinsipper (speilet)

| Prinsipp | Lunchportalen |
|----------|----------------|
| CMS stable, AI flexible | Content workspace eier publish; AI assistenter |
| Modular AI | Eksisterende API-ruter per oppgave |
| Optional AI | Feature-flag / av i env |
| Human approval | Workflow + governance-panel |
| Cost-aware | Kost-seksjon; detaljert dashbord operativt |
| No vendor lock-in | Provider via env |

## Hva som må vente

- Full «modellvelger» i UI — **REPLATFORMING_GAP** mot sikker policy-motor; U20 holder til **read-only status**.
