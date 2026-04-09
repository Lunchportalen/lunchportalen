# CMS Control Plane — Changed files (kumulativ + CP1 + CP2)

**Sist oppdatert:** 2026-03-29 (CP2)

## CP1 — Kode

| Fil | Hvorfor | Risiko |
|-----|---------|--------|
| `lib/cms/controlPlaneRuntimeStatusData.ts` | Én sannhetsliste for modulbadges (LIVE/LIMITED/DRY_RUN/STUB) | Lav — statisk data |
| `lib/cms/controlPlaneRuntimeStatus.ts` | Server-only getter | Lav |
| `app/(backoffice)/backoffice/_shell/CmsRuntimeStatusStrip.tsx` | Server UI: statusstrip | Lav — superadmin-only layout |
| `app/(backoffice)/backoffice/_shell/BackofficeShell.tsx` | `statusStrip`-prop | Lav |
| `app/(backoffice)/backoffice/layout.tsx` | Injiserer strip | Lav |
| `app/(backoffice)/backoffice/control/page.tsx` | Runtime-bro-lenker | Lav — navigasjon only |
| `tests/cms/controlPlaneRuntimeStatusData.test.ts` | Regresjon på badges | Lav |

## CP1 — Dokumenter

| Fil | Formål |
|-----|--------|
| `CP1_EXECUTION_PLAN.md` | Plan |
| `CP1_DOMAIN_LINKAGE_MATRIX.md` | Matrise |
| `CP1_WEEK_MENU_RUNTIME_CHAIN.md` | Uke/meny-kjede |
| `CP1_CHANGED_FILES.md` | CP1 filer |
| `CP1_EXECUTION_LOG.md` | Logg |
| Oppdaterte `CMS_*`, `UMBRACO_*`, `CMS_MAIN_*`, `CMS_CONTROL_PLANE_VERIFICATION.md` | CP1-spor |

## CP2 — se `CP2_CHANGED_FILES.md` for detaljert liste

## Tidligere sesjon (kun docs)

Se historikk i git for første CMS control plane dokumentasjon (kun markdown).
