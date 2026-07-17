# PHASE 16NO.1 — PRODUCTION LOCKS

**Captured:** 2026-07-17T17:50:00Z

## GATE 1 — Production auto-deploy lock

| Field | Value |
|-------|--------|
| PRODUCTION_AUTO_DEPLOY_LOCK | **ACTIVE** |
| Mechanism | Vercel project `commandForIgnoringBuildStep` |
| Project | `lunchportalen` / `prj_AJZzlPmgfbDyl05B44bwfymevnri` |
| Team | `team_xF02AHVvbtvIkbJtUzcxrKQY` |
| Before | `if [ "$VERCEL_ENV" = "production" ]; then echo "[14D.1] skip production git auto-deploy"; exit 0; fi; echo "[14D.1] allow non-production build"; exit 1` |
| After | `if [ "$VERCEL_ENV" = "production" ]; then echo "[16NO.1] PRODUCTION_AUTO_DEPLOY_LOCK skip git auto-deploy"; exit 0; fi; echo "[16NO.1] allow non-production build"; exit 1` |
| Semantics | Git-triggered **production** builds exit 0 → skipped. Preview/staging still build (exit 1). Controlled CLI/exact-SHA deploy remains possible. |
| Validation | Lock remains active after controlled CLI redeploy; git auto-deploy still skipped for production. |
| Current production SHA | `72072e8fa910db9ed9109b1566bdd7d05d57768d` |
| Current deployment ID | `dpl_ERhQLiGxLNGR3YGVs1b1uFxch7qh` |
| Umbraco / Azure / lunchportalen.no | untouched |

## GATE 2 — Production migration lock

| Field | Value |
|-------|--------|
| PRODUCTION_MIGRATION_LOCK | **ACTIVE** |
| Mechanism | GitHub Environment `Production` requires reviewer `Lunchportalen`; prod migrate job only on `push` to `main` with environment gate |
| PENDING_PRODUCTION_MIGRATION_WORKFLOWS | **0** (cancelled stuck run `29504427529` from 2026-07-16 that had no jobs started) |
| New migrations run in 16NO.1 | **none** |
