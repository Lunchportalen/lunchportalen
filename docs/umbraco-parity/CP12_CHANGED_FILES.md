# CP12 — Changed files

## Kode

| Fil | Hvorfor | Risiko |
|-----|---------|--------|
| `lib/cms/backofficeNavItems.ts` | `BACKOFFICE_DISCOVERY_EXTRAS`, `BACKOFFICE_PALETTE_ITEMS` | Statiske ruter |
| `components/backoffice/BackofficeCommandPalette.tsx` | Bruker `BACKOFFICE_PALETTE_ITEMS` | Navigasjon only |
| `components/cms/control-plane/CmsHistoryDiscoveryStrip.tsx` | CP12 ærlig historikk-/discovery-lenker | Lesing + lenker |
| `app/(backoffice)/backoffice/_shell/BackofficeShell.tsx` | `historyStrip` prop | Presentasjon |
| `app/(backoffice)/backoffice/layout.tsx` | Injiserer strip | Server layout |
| `tests/cms/backofficeCommandPalette.test.ts` | Palette + extras | Regresjon |

## Dokumentasjon

- `docs/umbraco-parity/CP12_*.md`

## Ikke endret

- Auth, middleware, ordre, billing, Supabase, onboarding, employee Week.
