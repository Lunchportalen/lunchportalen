# U19 — Changed files

## Kode

| Fil | Hvorfor | Risiko |
|-----|---------|--------|
| `lib/cms/backofficeDiscoveryIndex.ts` | **NY** — precomputert blob-map + `rankDiscoveryNavItems` (U19 indeksert discovery) | Lav — leser kun registry |
| `components/backoffice/BackofficeCommandPalette.tsx` | Bruker rankering etter filter | Lav |
| `components/cms/control-plane/CmsHistoryDiscoveryStrip.tsx` | Tre-spors UX-grid (redaksjonell tidslinje) | Lav — presentasjon |
| `components/backoffice/AiGovernanceHumanAndCostPanel.tsx` | **NY** — human approval, kost, env-forklaring | Statisk tekst |
| `app/(backoffice)/backoffice/ai-control/page.tsx` | Monterer governance-panel | Lav |
| `tests/cms/backofficeDiscoveryIndex.test.ts` | **NY** — indeksstørrelse + ranking | — |

## Dokumentasjon

`docs/umbraco-parity/U19_*.md`

## Ikke rørt

- auth, billing, onboarding, week/order API, middleware.
