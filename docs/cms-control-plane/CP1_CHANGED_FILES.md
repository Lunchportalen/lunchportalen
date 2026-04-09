# CP1 — Changed files

**Dato:** 2026-03-29

## Nye filer

| Fil | Formål |
|-----|--------|
| `lib/cms/controlPlaneRuntimeStatusData.ts` | Delt moduliste + typer (testbar uten server-only) |
| `lib/cms/controlPlaneRuntimeStatus.ts` | Server-only getter |
| `app/(backoffice)/backoffice/_shell/CmsRuntimeStatusStrip.tsx` | Server-komponent: statusstrip under TopBar |
| `tests/cms/controlPlaneRuntimeStatusData.test.ts` | Enhetstester |
| `docs/cms-control-plane/CP1_EXECUTION_PLAN.md` | Plan |
| `docs/cms-control-plane/CP1_DOMAIN_LINKAGE_MATRIX.md` | Matrise |
| `docs/cms-control-plane/CP1_WEEK_MENU_RUNTIME_CHAIN.md` | Uke/meny-kjede |
| `docs/cms-control-plane/CP1_CHANGED_FILES.md` | Denne filen |
| `docs/cms-control-plane/CP1_EXECUTION_LOG.md` | Logg |

## Endrede filer

| Fil | Hvorfor |
|-----|---------|
| `app/(backoffice)/backoffice/_shell/BackofficeShell.tsx` | Aksepterer `statusStrip` (ReactNode) for server-injert strip |
| `app/(backoffice)/backoffice/layout.tsx` | Sender inn `<CmsRuntimeStatusStrip />` |
| `app/(backoffice)/backoffice/control/page.tsx` | Seksjon «Operative tårn» med bro-lenker til superadmin |
| `docs/cms-control-plane/*` | Oppdaterte arbeidsstrømmer + sluttleveranse + verifikasjon |

## Risiko (minimal)

- Kun **superadmin** ser backoffice (layout-gate allerede).
- Ingen mutasjon av runtime-data; kun UI og lenker.
