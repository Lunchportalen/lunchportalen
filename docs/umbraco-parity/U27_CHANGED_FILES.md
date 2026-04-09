# U27 — Changed files

## Kodeendringer

| Fil | Hvorfor | Risiko |
|-----|---------|--------|
| `lib/cms/contentGovernanceUsage.ts` | Ren aggregasjon legacy/governed + blokktyper fra variant-body | Lav — ren funksjon, ingen DB-skriv |
| `app/api/backoffice/content/governance-usage/route.ts` | Read-only superadmin-API for management-innsikt | Lav — fail-closed via `scopeOr401` + `requireRoleOr403` |
| `app/(backoffice)/backoffice/settings/governance-insights/page.tsx` | Settings-UI for usage + legacy-lenker | Lav — client fetch av egen API |
| `app/(backoffice)/backoffice/settings/page.tsx` | Lenke til governance-insights | Lav |
| `app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx` | Trygg bulk: multi-select + kopier editor-lenker | Lav — kun clipboard |
| `tests/cms/contentGovernanceUsage.test.ts` | Regresjon på aggregator | Lav |

## Dokumentasjon

Nye filer under `docs/umbraco-parity/`:

- `U27_BULK_AND_LEGACY_BASELINE.md`, `U27_ENTITY_BULK_ACTIONS_MODEL.md`, `U27_LEGACY_MIGRATION_REVIEW_MODEL.md`, `U27_MANAGEMENT_USAGE_INSIGHTS_MODEL.md`, `U27_ENTITY_ACTIONS_CONSOLIDATION_MODEL.md`, `U27_REPLATFORMING_GAPS.md`, `U27_EXECUTION_LOG.md`, `U27_CHANGED_FILES.md`
- `U27_COLLECTIONS_RUNTIME.md`, `U27_LEGACY_RUNTIME.md`, `U27_ENTITY_ACTIONS_RUNTIME.md`, `U27_MANAGEMENT_RUNTIME.md`, `U27_HARDENING.md`, `U27_VERIFICATION.md`
- `U27_DECISION.md`, `U27_TRAFFIC_LIGHT_MATRIX.md`, `U27_SIGNOFF.md`, `U27_OPEN_RISKS.md`, `U27_NEXT_STEPS.md`

## Ikke rørt (bevisst)

- `middleware.ts`, auth, onboarding, billing, week/order runtime, frozen superadmin flows.
