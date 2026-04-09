# CP4 — Changed files

**Dato:** 2026-03-29

## Kode

| Fil | Hvorfor | Risiko |
|-----|---------|--------|
| `lib/cms/controlPlaneDomainActionSurfaces.ts` | Fellesobjekt for domain action surfaces (read/review/runtime-routing) | Lav |
| `lib/cms/backoffice/agreementScheduleAbbrev.ts` | `summarizeAgreementScheduleForCms` — innsyn fra `agreement_json` | Lav — bruker eksisterende `normalizeAgreement` |
| `components/cms/control-plane/CmsDomainActionSurfaceCard.tsx` | Viser kilde, posture, handlinger | Lav |
| `components/cms/control-plane/CmsWeekMenuPublishControlsPanel.tsx` | Operativ vs editorial governance | Lav |
| `components/cms/control-plane/CmsAgreementRuntimePreviewTable.tsx` | Plan/binding-tabell for superadmin-innsyn | Lav |
| `app/(backoffice)/backoffice/agreement-runtime/page.tsx` | Ny CMS-flate for avtale-runtime | Lav — samme gate som `loadDomainRuntimeOverview` |
| `app/(backoffice)/backoffice/_shell/CmsRuntimeStatusStrip.tsx` | LIVE → «Published» i visning | Lav |
| `app/(backoffice)/backoffice/_shell/TopBar.tsx` | Fane «Avtale» | Lav |
| `app/(backoffice)/backoffice/domains/page.tsx` | Erstatter løse kort med action surfaces | Lav |
| `app/(backoffice)/backoffice/control/page.tsx` | Action surfaces + growth-status + lenke avtale-runtime | Lav |
| `app/(backoffice)/backoffice/week-menu/page.tsx` | Publish panel + editorial banner | Lav |
| `tests/cms/controlPlaneDomainActionSurfaces.test.ts` | Dekning av surface-data | Lav |
| `tests/cms/agreementScheduleAbbrev.test.ts` | Normalisering av avtale-JSON | Lav |

## Dokumentasjon

- `docs/cms-control-plane/CP4_*.md`, `CMS_WEEK_MENU_*`, `CMS_COMPANY_*`, `CMS_CONTROL_TOWERS_DEEPER_ALIGNMENT.md`, `CMS_GROWTH_MODULE_CONSISTENCY.md`, `CMS_ENTERPRISE_HARDENING_CP4.md`
- `CMS_CONTROL_PLANE_VERIFICATION.md` (CP4)

## Ikke endret (bevisst)

- `GET /api/week`, ordre, billing, auth, middleware, Supabase-schema.
