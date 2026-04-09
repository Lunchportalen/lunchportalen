# U28 — Changed files

## Kode

| Fil | Hvorfor | Risiko |
|-----|---------|--------|
| `lib/cms/contentGovernanceUsage.ts` | Coverage: allowlist OK / fail / invalid DT | Lav — ren aggregering |
| `app/api/backoffice/content/batch-normalize-legacy/route.ts` | Reviewbar batch med dry-run; `withCmsPageDocumentGate` for control coverage | Medium — superadmin-only, cap, audit |
| `components/backoffice/backofficeEntityActionStyles.ts` | Delt primær entity-lenke-stil | Lav |
| `app/(backoffice)/backoffice/settings/governance-insights/page.tsx` | Coverage UI + batch-kontroller | Lav — superadmin API |
| `app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx` | Bruker delt entity-lenke-stil | Lav |
| `tests/cms/contentGovernanceUsage.test.ts` | Regresjon coverage | Lav |
| `tests/cms/batchNormalizeLegacy.test.ts` | Preview-paritet | Lav |

## Dokumentasjon

`docs/umbraco-parity/U28_*.md` (baseline, runtime, closing).

## Ikke rørt

`middleware.ts`, auth, onboarding, billing, week/order, frozen superadmin-lister utover nye API-ruter under backoffice content.
