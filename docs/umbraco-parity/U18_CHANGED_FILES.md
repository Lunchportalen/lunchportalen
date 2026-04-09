# U18 — Changed files

## Kode

| Fil | Hvorfor | Risiko |
|-----|---------|--------|
| `lib/cms/backofficeExtensionRegistry.ts` | `discoveryAliases`, tårn-rader i palett, utvidet `filterBackofficeNavItems` (blob), `AI Center` label | Lav — samme manifest |
| `components/backoffice/BackofficeCommandPalette.tsx` | Hjelpetekst om alias | Lav |
| `components/cms/control-plane/CmsHistoryDiscoveryStrip.tsx` | U18 unified historikk-fortelling (ærlig, punktliste) | Lav — tekst/UX |
| `components/backoffice/AiGovernanceOverview.tsx` | **NY** — modulposture-tabell + hurtiglenker | Lesing fra eksisterende register |
| `app/(backoffice)/backoffice/ai-control/page.tsx` | AI Control Center + governance over autonom kjøring | Lav |

## Dokumentasjon

Alle `docs/umbraco-parity/U18_*.md` i denne fasen.

## Ikke rørt

- `middleware.ts`, auth, billing, onboarding, week API, ordre, Supabase/Vercel-oppsett.
