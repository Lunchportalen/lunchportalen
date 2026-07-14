# PHASE 14A — RC file manifest

**Branch:** `release/global-invoice-only-foundation`  
**Previous RC SHA:** `f538d9035e64e62fa164c778bc7ac764e454722e`  
**Production SHA:** `98b3b15e258966dd61ad967af5876982bcfcb959`  
**Generated:** 2026-07-14 (Phase 14A gate 1)

## Scope

Global invoice-only release candidate — Phase 13 orchestrator, P0 migrations, 21-country proof, i18n snapshots, Vitest harness stabilization. **No production/staging mutation in this phase.**

## Included files (release set)

| Path | Domain | Source commit | Reason | Migration | Runtime |
|------|--------|---------------|--------|-----------|---------|
| `package.json` | build | f538d903+ | RC npm scripts (orchestrator, manifest, 21-country proof) | none | scripts only |
| `vitest.config.ts` | test-harness | 14A | Lock NODE_ENV=test; react act setup | none | local test only |
| `tests/_setup/reactActEnvironment.ts` | test-harness | 14A | IS_REACT_ACT_ENVIRONMENT before React load | none | test only |
| `tests/_helpers/reactAct.ts` | test-harness | 14A | Canonical Vitest act (React 19) | none | test only |
| `tests/cms/contentWorkspaceData.deps.test.ts` | CMS | 14A | Node fs contract checks (split from jsdom) | none | test only |
| `tests/cms/contentWorkspaceStability.smoke.test.ts` | CMS | 14A | Remove jsdom fs dynamic import | none | test only |
| `tests/governance/g5d7a-runtime-hook-governance-contracts.test.ts` | governance | 14A | Exclude artifact dirs from repo walk | none | test only |
| `tests/rls/tenantIsolation.final.test.ts` | RLS | 14A | skipIf(!hasDb) fail-closed when integration off | none | staging opt-in |
| `tests/**/*.test.ts(x)` (act import migration) | various | 14A | React 19 act harness fix (27 files) | none | test only |
| `scripts/verify/phase13-21-country-rc-proof.mjs` | orchestrator | phase13 | Fail-closed RC orchestrator | none | local/staging verify |
| `scripts/verify/rcOrchestratorCore.mjs` | orchestrator | phase14 | Step runner core | none | local verify |
| `scripts/verify/generate-release-manifest.mjs` | orchestrator | phase13 | SHA + migration checksum manifest | none | local verify |
| `scripts/ci/rc-orchestrator-behavior.test.mjs` | CI | phase14 | Orchestrator behavior tests | none | CI/local |
| `tests/integration/full-21-country-rc-proof.integration.test.ts` | integration | phase13 | 21-country lifecycle proof | requires staging | staging opt-in |
| `tests/i18n/invoiceAndEmailSnapshots.test.tsx` | i18n | phase13 | Invoice/email snapshot gate | none | test only |
| `tests/i18n/__snapshots__/invoiceAndEmailSnapshots.test.tsx.snap` | i18n | phase13 | Snapshot artifacts | none | test only |
| `supabase/migrations/20260827120000_orders_currency_market_truth.sql` | migration | phase13 | Orders currency market truth | **yes** | DB |
| `supabase/migrations/20260827130000_order_line_snapshots_detach_fk.sql` | migration | phase13 | Order line snapshot FK detach | **yes** | DB |
| `docs/rc/phase13-staging-rc-proof.md` | rc-docs | phase13 | Staging RC evidence | none | docs |
| `docs/rc/phase13-release-manifest.md` | rc-docs | phase13/14 | Immutable migration checksums | none | docs |
| `docs/rc/phase14-remediation-preflight.md` | rc-docs | phase14 | Preflight remediation notes | none | docs |
| `docs/rc/PHASE14A-VITEST-FAILURE-MATRIX.md` | rc-docs | 14A | Vitest triage record | none | docs |
| `docs/rc/PHASE14A-RC-FILE-MANIFEST.md` | rc-docs | 14A | This manifest | none | docs |

**Migration count:** 83 total (14 pending vs production head `20260818120000`)

## Excluded (99 dirty workspace files — do not commit)

| Category | Count | Examples | Reason |
|----------|------:|----------|--------|
| Sanity/content artifacts | 18 | `artifacts/u97*/**` | Generated screenshots |
| E2E visual snapshots | 28 | `e2e/**/*.png`, `e2e/visual.e2e.ts` | Local Playwright regen |
| Temp probe scripts | 26 | `scripts/temp-*.mjs` | Local staging probes |
| Secrets/env | 1 | `.env.preview.verify` | Secret risk |
| PR drafts | 5 | `.pr-body-*.md` | Local only |
| Geography review | 9 | `_geography-review-surface/**` | Review screenshots |
| Package manager experiment | 2 | `pnpm-lock.yaml`, `pnpm-workspace.yaml` | Unrelated to npm RC |
| Local temp | 2+ | `temp/**` | Dry-run scripts |
| Logs/reports | many | `.backups/**`, `playwright-report/**`, `test-results/**` | Never commit |

## Protected paths

| Check | Result |
|-------|--------|
| Umbraco files changed | 0 |
| Azure resources changed | 0 |
| lunchportalen.no deploy | NO |
| Stripe activated | NO |
| invoice_only preserved | YES |

## Checksum sample (SHA256 prefix)

See `docs/rc/phase13-release-manifest.md` for full migration checksum block (regenerated at commit time).
