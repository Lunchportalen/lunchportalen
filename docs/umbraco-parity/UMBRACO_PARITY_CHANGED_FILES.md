# Umbraco parity — changed files

## Kode (minimal)

| Fil | Hvorfor | Minimal risiko |
|-----|---------|----------------|
| `lib/cms/controlPlaneDomainActionSurfaces.ts` | `week_menu` actionRouting reflekterer CP7 server-broker (`POST .../sanity/menu-content/publish`) ved siden av Studio | Kun metadata/tekst for kontrollplan-sannhet; ingen runtime-endring |

## Dokumentasjon

- Hele mappen `docs/umbraco-parity/` (alle `UMBRACO_PARITY_*.md`).

## Ikke endret

- Auth, middleware, ordre, billing, Supabase, employee week API, onboarding.
