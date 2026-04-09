# U37 Changed Files

## Runtime Truth
- `lib/cms/contentAuditActions.ts` — introduced canonical audit publish action constant — low risk because it only centralizes an existing string contract.
- `app/api/backoffice/content/pages/[id]/variant/publish/route.ts` — aligned publish write-path with DB audit constraint — low risk because only audit action value changed.
- `lib/system/settingsRepository.ts` — exposed richer repository error detail — low risk because read contract only became more explicit.
- `lib/system/settings.ts` — introduced canonical system baseline reader and statuses — localized to settings truth, fail-closed by design.
- `lib/settings/getSettings.ts` — aligned compatibility helper with canonical baseline — low risk because degraded states now return `null` instead of pretending ready truth.
- `app/api/backoffice/settings/route.ts` — made backoffice settings read-path canonical and baseline-aware — low risk because it consolidates existing behavior instead of adding a new engine.
- `app/(backoffice)/backoffice/settings/system/page.tsx` — surfaced baseline status and read-only lock in UI — low risk because save is only disabled when baseline is unsafe.
- `lib/hooks/useSettings.ts` — adapted client payload parsing to `settings + baseline` — low risk because it only unwraps API data.
- `lib/esg/latestMonthlyRollupList.ts` — normalized canonical vs legacy ESG column sets — low risk because it preserves one output shape and only adds explicit fallback.
- `app/api/backoffice/esg/latest-monthly/route.ts` — returned ESG baseline alongside data — low risk because response becomes richer, not looser.
- `app/api/admin/esg/latest-monthly/route.ts` — same ESG baseline propagation for admin route — low risk for same reason.
- `app/api/superadmin/esg/latest-monthly/route.ts` — same ESG baseline propagation for superadmin route — low risk for same reason.
- `app/(backoffice)/backoffice/esg/EsgRuntimeClient.tsx` — surfaced degraded ESG baseline in UI — low risk because it only makes existing uncertainty explicit.

## Settings / Management Posture
- `lib/cms/backofficeExtensionRegistry.ts` — marked `system` as runtime-managed — low risk because it changes classification, not runtime scope.
- `lib/cms/backofficeSettingsWorkspaceModel.ts` — added honesty/flow labels for runtime-managed system settings — low risk because it only changes workspace metadata.
- `app/(backoffice)/backoffice/settings/_components/SettingsSectionChrome.tsx` — reflected updated system posture in settings chrome — low risk because it is presentational wiring.

## Editor / Compat Shutdown
- `lib/cms/backofficeBlockCatalog.ts` — added canonical block catalog from plugins — low risk because it reuses existing plugin truth.
- `lib/cms/editorBlockCreateOptions.ts` — derived create options from canonical catalog — low risk because it removes duplication.
- `app/(backoffice)/backoffice/content/_components/BlockPickerOverlay.tsx` — moved rich block discovery onto canonical catalog — low risk because UI keeps same purpose.
- `app/(backoffice)/backoffice/content/_components/ContentWorkspaceModalStack.tsx` — replaced old block registry type with canonical catalog type — low risk because it is type-level alignment.
- `app/(backoffice)/backoffice/content/_components/contentWorkspaceModalShellProps.ts` — aligned modal pick handler to canonical block type — low risk because runtime flow is unchanged.
- `app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks.ts` — moved block draft creation to canonical catalog and removed duplicated type allowlist — low risk because defaults still come from existing plugin definitions.
- `app/(backoffice)/backoffice/content/_components/blockRegistry.ts` — removed competing legacy block registry — low risk because all call sites were moved first.

## Tree / Audit Operator UX
- `lib/cms/auditLogTableError.ts` — centralized degraded audit classification and payload building — low risk because logic moved from route-local duplication to one helper.
- `app/api/backoffice/content/audit-log/route.ts` — reused canonical audit degraded helper — low risk because response contract stayed compatible but became richer.
- `lib/cms/treeRouteSchema.ts` — centralized tree schema issue classification with missing columns and codes — low risk because it formalizes existing route behavior.
- `app/api/backoffice/content/tree/route.ts` — reused canonical tree issue payloads — low risk because response stays 200/degraded for known schema drift.
- `app/(backoffice)/backoffice/content/_tree/mapTreeApiRoots.ts` — parsed missing columns and technical codes — low risk because envelope parsing only became richer.
- `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx` — showed missing columns and technical code in degraded tree banner — low risk because normal tree flow is unchanged.
- `app/(backoffice)/backoffice/content/_components/ContentWorkspaceAuditTimeline.tsx` — showed technical audit code in degraded timeline UI — low risk because it only adds operator detail.

## Tests
- `tests/cms/treeRouteSchema.test.ts` — locked tree schema issue classification — low risk because tests only capture existing runtime rules.
- `tests/lib/auditLogTableError.test.ts` — locked audit degraded payload classification — low risk because tests only exercise helper logic.
- `tests/api/contentAuditLogRoute.test.ts` — locked degraded audit route payloads for missing table and missing column — low risk because route contract is already public.
- `tests/api/treeRouteDegradable.test.ts` — locked degraded tree payload detail/code — low risk because test only asserts explicit degraded behavior.
- `tests/api/treeRoutePageKeyFallback.test.ts` — locked `page_key` fallback hints and operator message — low risk because it documents existing fallback.
- `tests/cms/mapTreeApiRoots.test.ts` — locked client envelope parsing for missing columns/code — low risk because it is pure mapping logic.
- `tests/api/variantPublishRoute.test.ts` — locked publish route against canonical audit action — low risk because it prevents regression of a known contract bug.
- `tests/cms/contentWorkspaceBlocks.test.ts` — locked block creation against canonical catalog defaults — low risk because it checks pure helper behavior.
- `tests/cms/backofficeSettingsWorkspaceModel.test.ts` — locked `system` as runtime-managed workspace — low risk because it checks metadata only.
- `tests/lib/systemSettingsBaseline.test.ts` — added baseline truth tests for system settings — low risk because it isolates helper logic.
- `tests/esg/latestMonthlyRollupList.test.ts` — added canonical vs legacy ESG fallback tests — low risk because it isolates loader behavior.

## U37 Docs
- `docs/umbraco-parity/U37_*.md` — steering docs, runtime docs, decision docs and verification docs created/updated — low risk because they document landed behavior and open conditions without changing runtime.
