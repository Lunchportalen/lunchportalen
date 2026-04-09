# CP3 — Changed files

**Dato:** 2026-03-29

## Kode

| Fil | Hvorfor | Risiko |
|-----|---------|--------|
| `lib/cms/backoffice/domainRuntimeOverviewShared.ts` | Pure helpers: `summarizeAgreementJson`, `aggregateLocationCounts` — testbar uten DB | Lav |
| `lib/cms/backoffice/loadDomainRuntimeOverview.ts` | Superadmin-gate; read-only snapshot (firma-rader, ordre 7d, modulstatus) | Lav — samme mønster som `loadControlPlaneRuntimeSnapshot` |
| `lib/cms/backoffice/loadDomainRuntimeOverview.ts` (TS) | `base.ok === false` for korrekt narrowing mot `ControlPlaneRuntimeSnapshot` | Lav |
| `app/(backoffice)/backoffice/domains/page.tsx` | Domenehub | Lav |
| `app/(backoffice)/backoffice/customers/page.tsx` | Kunder/avtaler innsyn | Lav |
| `app/(backoffice)/backoffice/week-menu/page.tsx` | `CmsWeekRuntimeStatusPanel` + eksisterende meny-tabell | Lav |
| `app/(backoffice)/backoffice/control/page.tsx` | Lenker til domener/kunder/week-menu | Lav |
| `app/(backoffice)/backoffice/_shell/TopBar.tsx` | Faner Domener/Kunder; `isDomains`/`isCustomers` for aktiv tilstand | Lav |
| `components/cms/control-plane/CmsCompanyAgreementLocationPanel.tsx` | Read-only tabell | Lav |
| `components/cms/control-plane/CmsWeekRuntimeStatusPanel.tsx` | Forklaring av operativ kjede | Lav |
| `components/cms/control-plane/RuntimeDomainLinkCard.tsx` | Status-kort | Lav |
| `tests/cms/domainRuntimeOverview.test.ts` | Enhetstester for shared helpers | Lav |

## Dokumentasjon

- `docs/cms-control-plane/CP3_*.md` (denne pakken)
- `CMS_CONTROL_PLANE_VERIFICATION.md` (oppdatert for CP3)

## Ikke endret (bevisst)

- Auth, onboarding, employee week view, order/window, billing engine, Supabase-schema, `middleware.ts` (unntatt indirekte via uendrede flyter).
