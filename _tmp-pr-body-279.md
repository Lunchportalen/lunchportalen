## Summary
- Re-skin `/leverandor/meny` in place: `lp-editor-*` namespace, `provider-menu-editor.css`, wired `ProviderMenuBuilder` + subcomponents (no duplicate editor)
- **Visual gate = live route:** `e2e/provider-meny-visual-regression.e2e.ts` screenshots `.lp-editor-root` on seeded `/leverandor/meny`
- **Badge precedence:** `orderLocked > providerOverride > autoFilled` + unit test; Tue 2026-06-16 fixture is override+locked with count 14
- **Tier snapshots:** Enterprise (premium + upgrade visible) + Basis (premium hidden)
- **CI:** `.github/workflows/ci-provider-meny-visual.yml` on `mcr.microsoft.com/playwright:v1.58.2-noble` — PR runs never use `--update-snapshots` (workflow_dispatch only)

## RETUR-3 — determinisme, passthrough, Linux guard

### Screenshot data source (no live Sanity / no 4udoq5d8/production)
- **Screenshot-visible menu content** comes from a **Playwright route stub** on `GET **/api/provider/menu-days**` in `e2e/helpers/provider-meny-visual.ts` (`installProviderMenyVisualMocks`).
- Fixture body: `buildProviderMenyVisualMenuDaysResponse()` + `e2e/fixtures/provider-meny-catalog.json` (same catalog pattern as other provider-meny tests).
- POST to menu-days still `route.continue()` — writes are not stubbed.
- E2E assertions prove stub data on screen: `Kyllinggryte`, `14 ansatte har bestilt` (Tue 2026-06-16 locked day).
- `docs/visual-qa/provider-meny/leverandor-meny-referanse.html` is eyes-on only — never CI.

### Sanity dataset guard (HARD — fail closed)
- `e2e/helpers/visual-e2e-sanity-guard.ts` — blocks `production` / `prod` dataset
- Called in `e2e/global-setup/provider-meny-visual-auth.setup.ts` before auth
- CI step **Verify visual E2E Sanity dataset is not production** in `ci-provider-meny-visual.yml`
- Vitest: `tests/e2e/visual-e2e-sanity-guard.test.ts`
- Analog to existing uigx-vs-prod Supabase guard in the same workflow

### Required-check passthrough (`provider-meny-visual`)
- Branch-protection context name: **`provider-meny-visual`** (`REQUIRED_CHECK_CONTEXT_NAMES.provider_meny_visual`)
- Passthrough job in `required-checks-passthrough.yml` when `provider_meny_visual_touched != true`
- Path patterns in `scripts/ci/required-check-path-patterns.mjs` mirror `ci-provider-meny-visual.yml` (drift guard enforced)
- **Proof PR (docs-only, no visual paths):** https://github.com/Lunchportalen/lunchportalen/pull/280 — expect `provider-meny-visual` passthrough **success**, not pending

### Linux baseline guard
- `playwright.provider-meny.config.ts` throws if `--update-snapshots` on non-linux
- CI snapshot-update path requires `uname -s` = Linux

## Baselines
- **Platform:** Linux (Playwright noble / GitHub Actions container)
- **Paths:** `e2e/provider-meny-visual-regression.e2e.ts-snapshots/provider-meny-desktop/`
  - `provider-meny-enterprise-provider-meny-desktop.png`
  - `provider-meny-basis-provider-meny-desktop.png`
- Win32 referanse snapshots removed

## Gate bite proof (E) — VERIFIED in Linux CI
Workflow: [CI Provider Meny Visual — prove_gate_bite](https://github.com/Lunchportalen/lunchportalen/actions/runs/27909356254)
- Runtime probe: `LP_PROVIDER_MENY_VISUAL_GATE_PROBE=1` → visual e2e **RED** → revert → **GREEN**

## Merge-SHA CI (PR-head)
- **SHA:** `53dd93afc1f4a3a5b16f634fc6f8f5affddce563` (RETUR-3)
- CI runs on push — see PR checks tab for Provider Meny Visual + typecheck/vitest

## Test plan
- [x] `npm run typecheck`
- [x] vitest: badges, order lock, `visual-e2e-sanity-guard`
- [x] CI Provider Meny Visual on Linux (RETUR-3 head)
- [x] Passthrough proof PR #280
- [x] Gate bite: RED → revert → GREEN (run 27909356254)

**MERGE: Thomas** — agent stops here.
