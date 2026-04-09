# CP7 — Endrede filer

## Kode

| Fil | Hvorfor | Minimal risiko |
|-----|---------|----------------|
| `lib/sanity/menuContentPublishOps.ts` | Ny broker: Sanity Actions publish for `menuContent` draft | Ingen DB-endring; fail-closed ved manglende token |
| `app/api/backoffice/sanity/menu-content/publish/route.ts` | Superadmin API for publish | Samme gate som øvrig backoffice; 503 uten token |
| `components/cms/control-plane/CmsMenuContentNativePublishPanel.tsx` | In-CMS publish UI | Kun fetch til egen API |
| `components/cms/control-plane/CmsWeekMenuPublishOrchestrator.tsx` | Inkluderer native panel | Presentasjon |

## Dokumentasjon

- Nye/oppdaterte filer under `docs/cms-control-plane/` med prefix `CP7_*`, `CMS_*_CP7.md`, verifikasjon.

## Ikke endret

- Auth, middleware, onboarding, ordre-API, billing, Supabase-skjema, `weekPlan` schema.
