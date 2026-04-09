# CP11 — Changed files

## Kode

| Fil | Hvorfor | Minimal risiko |
|-----|---------|----------------|
| `components/backoffice/BackofficeWorkspaceSurface.tsx` | CP11 felles workspace-krom (H1, lead, `data-workspace`, valgfri publish/history-notis, `fullBleed`) | Kun presentasjon |
| `lib/cms/backofficeNavItems.ts` | `groupId` + `groupFilteredBackofficeNavItems` for palett | Statiske ruter |
| `components/backoffice/BackofficeCommandPalette.tsx` | Grupperte treff (CP11) | Samme navigasjon |
| `app/(backoffice)/backoffice/domains/page.tsx` | `BackofficeWorkspaceSurface` | Innhold uendret |
| `app/(backoffice)/backoffice/customers/page.tsx` | Samme | — |
| `app/(backoffice)/backoffice/agreement-runtime/page.tsx` | Samme | — |
| `app/(backoffice)/backoffice/week-menu/page.tsx` | Surface + ærlig publish/history-notis | Tekstklarhet |
| `app/(backoffice)/backoffice/seo-growth/page.tsx` | `fullBleed` surface | Én H1 |
| `app/(backoffice)/backoffice/social/page.tsx` | Samme | Én H1 |
| `app/(backoffice)/backoffice/esg/page.tsx` | Samme | Én H1 |
| `app/(backoffice)/backoffice/seo-growth/SeoGrowthRuntimeClient.tsx` | Fjernet duplikat-H1/intro | — |
| `app/(backoffice)/backoffice/social/SocialCalendarRuntimeClient.tsx` | Fjernet duplikat-header | — |
| `app/(backoffice)/backoffice/esg/EsgRuntimeClient.tsx` | Fjernet duplikat-header | — |
| `app/(backoffice)/backoffice/media/page.tsx` | `BackofficeWorkspaceHeader`, bredde 1440 | Visuell justering |

## Tester

| Fil | Hvorfor |
|-----|---------|
| `tests/cms/backofficeCommandPalette.test.ts` | `groupId`, grupperingsorden |

## Dokumentasjon

- `docs/umbraco-parity/CP11_*.md`

## Ikke endret

- Middleware, auth, ordre/billing, Supabase, onboarding, employee Week, kitchen/driver API.
