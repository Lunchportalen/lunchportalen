# U37 Verifikasjon

## Full Gates
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run build:enterprise` — PASS
- `npm run test:run` — PASS
- `npm run sanity:live` — SOFT PASS (`localhost:3000` utilgjengelig, skriptet skip-passet med exit 0)

## Build/Test Facts
- `build:enterprise` kompilerte ferdig i `20.8min`.
- Full `test:run` endte grønt med `244` testfiler og `1309` tester.
- En typecheck-feil i `lib/esg/latestMonthlyRollupList.ts` ble oppdaget under full gate og lukket før endelig grønn kjøring.

## Focused Regression Coverage Added/Updated
- Tree schema helper / degraded klassifisering.
- Tree route degraded + `page_key` fallback.
- Audit degraded helper + route payload.
- Publish-route låst mot korrekt audit action.
- System settings baseline-status.
- ESG canonical vs legacy fallback.
- Canonical block catalog/defaults i content workspace.
- Runtime-managed system workspace posture.
