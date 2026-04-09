# Phase 2D — Next steps

## Ferdig (2D3) — ESG runtime MVP

- **CMS:** `/backoffice/esg` — firmaliste (`esg_monthly` + navn), snapshot-innsikt (`esg_monthly_snapshots` / `esg_yearly_snapshots`), metode-/tillitslag, lenke til superadmin for PDF/eksport.
- **Delt logikk:** `fetchCompanyEsgSnapshotSummary`, `loadLatestMonthlyRollupList`.
- **Dokumentasjon:** `ESG_*` under `docs/phase2d/`.

## Videre (utenfor avsluttet 2D3-scope)

- Eventuell **company_admin**-UI som kobler tydelig til `GET /api/admin/esg/summary` (allerede tilgjengelig API).
- **Revisjons-/definisjonspakke** for stabilitet og svinn (se `ESG_RUNTIME_PLAN.md`).
- **Ingen** automatisk start av nye plattformfaser her.

## Stoppregel

- Phase **2D0–2D3** growth-leveranser er **lukket** i denne dokumentasjonen inntil ny eksplisitt scope.

## Tester (referanse)

- `tests/esg/oslo-month.test.ts`
- `tests/api/backofficeEsgSummaryRoute.test.ts`
- `tests/superadmin/capabilities-contract.test.ts`
- `npm run typecheck`, `npm run build:enterprise`
