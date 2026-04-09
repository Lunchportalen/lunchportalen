# CP2 — Changed files

**Dato:** 2026-03-29

## Kode

| Fil | Hvorfor | Risiko |
|-----|---------|--------|
| `lib/cms/sanityStudioUrl.ts` | Studio base URL for meny-redigering | Lav — read-only URL |
| `lib/cms/backoffice/loadControlPlaneRuntimeSnapshot.ts` | Read-only aggregater (superadmin + admin client) | Lav — samme mønster som overview API |
| `app/(backoffice)/backoffice/runtime/page.tsx` | Runtime hub UI | Lav |
| `app/(backoffice)/backoffice/week-menu/page.tsx` | Meny/uke-kjede + Sanity-lesing | Lav — read-only |
| `app/(backoffice)/backoffice/_shell/TopBar.tsx` | Faner Runtime, Uke & meny | Lav |
| `app/(backoffice)/backoffice/control/page.tsx` | Lenker til runtime + week-menu | Lav |
| `tests/cms/sanityStudioUrl.test.ts` | Regresjon URL | Lav |

## Dokumentasjon

Alle `CP2_*.md`, `CMS_*` CP2-leveranser, oppdatert `CMS_CONTROL_PLANE_VERIFICATION.md`.

## Ikke endret

- Auth, onboarding, `GET /api/week`, order/window, billing engine, middleware.
