# PHASE 18SCALE — Load harness

## Tooling

- **k6** for constant-arrival-rate HTTP waves (orders / cancellations)
- **Node** scripts for seed, sessions, cutoff, freeze, finance, soak, cleanup
- Path: `scripts/phase18scale/`

## Environment safety

1. Prefer local Supabase: `npx supabase start --exclude storage,analytics,vector,imgproxy --ignore-health-check`
2. Write keys to `.env.phase18.local` (gitignored) from `supabase status -o env`
3. Set `PHASE18_BASE_URL=http://127.0.0.1:3000`
4. Never point at `hkpokyapzarefrgqzkos` or `app.lunchportalen.no`
5. Shared staging (`uigxsboqeruxflgzqztl`) refused unless isolation attestation + `PHASE18_ALLOW_STAGING_ISOLATION=1`

## Required scripts

| Script | Role |
|--------|------|
| `seed-scale-matrix.mjs` | 1000/2000/100k synthetic matrix |
| `issue-auth-sessions.mjs` | Employee tokens for k6 |
| `order-wave.mjs` + `k6/order-wave.js` | Order RPS waves |
| `cancellation-wave.mjs` + `k6/cancellation-wave.js` | Cancel RPS waves |
| `cutoff-boundary-wave.mjs` | Before/at/after cutoff |
| `hot-provider-wave.mjs` | Skew traffic |
| `production-freeze-check.mjs` | Snapshot invariants |
| `financial-reconciliation.mjs` | Commission reconcile |
| `soak-runner.mjs` | ≥8h mixed soak |
| `failure-injection.mjs` | Controlled faults |
| `cleanup-scale-matrix.mjs` | Synthetic teardown |

## Smoke (preflight)

```bash
PHASE18_SEED_PROVIDERS=2 PHASE18_SEED_COMPANIES=4 PHASE18_SEED_EMPLOYEES=20 \
  node scripts/phase18scale/seed-scale-matrix.mjs
```

## Full certification

Use workflow `phase18scale-load-cert.yml` (manual) against a dedicated load project/branch with secrets under GitHub environment `load-cert`.
