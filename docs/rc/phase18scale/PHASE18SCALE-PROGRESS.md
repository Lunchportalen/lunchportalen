# PHASE 18SCALE — Progress

## Baseline

- Branch: `release/global-menu-universes-21`
- PHASE18_START_SHA / ENGINE_SHA: `c4df05397374648025024d67204d801cae6f93ea`
- Prior 17MENU.2D GHA: `29678182861`
- GLOBAL_MENU_UNIVERSES_TECHNICAL_PASS: YES (unchanged)

## Load environment

- Mode: **local Supabase ephemeral** (`127.0.0.1:54321`)
- Isolation: YES (not shared staging, not production)
- Email: local Inbucket blackhole
- Paid infrastructure used: **NO**
- Fallback evaluated: Supabase branch @ $0.01344/hour (not activated)

## Delivered so far

- `docs/rc/phase18scale/evidence/source-target-matrix.json`
- Harness under `scripts/phase18scale/` (seed, sessions, k6 waves, cutoff, hot-provider, freeze, finance, soak, failure, cleanup)
- Migration `20260908120000_phase18scale_production_snapshots.sql`
- Manual workflow `.github/workflows/phase18scale-load-cert.yml`
- ci-guard allowlist for `scripts/phase18scale/`

## Next execution steps

1. Finish `supabase db reset` on local stack
2. Smoke seed (2/4/20) then full 1000/2000/100k
3. Issue sessions + Next runtime + order/cancel waves
4. Cutoff / freeze / finance / soak / breakpoint
5. Final certification matrix → GLOBAL_SCALE_CERTIFIED only if all hard gates pass

## Status

- GLOBAL_SCALE_CERTIFIED = NO (in progress)
- NATIVE_CULINARY_APPROVED = 0/21
- LOCALE_NATIVE_APPROVED = 0/24
- PRODUCTION_DEPLOYMENT = NOT APPROVED
