## Summary (RETUR-3 — gate-herding, follow-up to merged #279)

#279 merged at `359813f0` before RETUR-3 landed. This PR adds the remaining hardening.

### 1. Screenshot determinism (no Sanity production)
- **Screenshot menu content** = Playwright stub on `GET **/api/provider/menu-days**` (`installProviderMenyVisualMocks` in `e2e/helpers/provider-meny-visual.ts`), not live Sanity reads.
- Fixture: `buildProviderMenyVisualMenuDaysResponse()` + `e2e/fixtures/provider-meny-catalog.json`.
- E2E proves stub on screen: `Kyllinggryte`, `14 ansatte har bestilt`.
- **HARD guard:** `e2e/helpers/visual-e2e-sanity-guard.ts` + global-setup + CI step + vitest — blocks `production`/`prod` dataset (analog to uigx Supabase guard).

### 2. Required-check passthrough (`provider-meny-visual`)
- Context name: **`provider-meny-visual`** (`REQUIRED_CHECK_CONTEXT_NAMES.provider_meny_visual`).
- Passthrough job when `provider_meny_visual_touched != true` in `required-checks-passthrough.yml`.
- Path patterns mirror `ci-provider-meny-visual.yml` (drift guard).
- **Proof PR (docs-only):** https://github.com/Lunchportalen/lunchportalen/pull/280 — `provider-meny-visual` passthrough **success** in 2s (run 27910474425).

### 3. Linux baseline guard
- `playwright.provider-meny.config.ts` throws on `--update-snapshots` when `process.platform !== 'linux'`.
- CI update path requires `uname -s` = Linux.

## Merge-SHA CI (PR-head)
- **SHA:** `4cd5ec2bc0a9a686d4af631e034a38191691b1cf`
- **Provider Meny Visual:** https://github.com/Lunchportalen/lunchportalen/actions/runs/27911135712 — **PASS** (6m59s)
- Sanity dataset: hardcoded `staging` in workflow (org secret is `production`; guard blocks prod)

## Note on #279
#279 merged at `359813f0` before RETUR-3 landed. This PR (`#281`) is the gate-herding follow-up.

## Test plan
- [x] `npm run typecheck` + vitest (in CI workflow)
- [x] CI Provider Meny Visual on Linux (run 27911135712)
- [x] Passthrough proof PR #280

**MERGE: Thomas** — agent stops here.