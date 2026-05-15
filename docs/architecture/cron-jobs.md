# Cron jobs — Lunchportalen

## Authentication (`lib/http/cronAuth.ts`)

All routes that call `requireCronAuth()` accept:

1. **`x-vercel-cron: 1`** — Injected by [Vercel Cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs) on scheduler invocations. External clients cannot set this header on Vercel’s edge for arbitrary hosts; it is the primary trust signal when `CRON_SECRET` is **not** configured (Vercel may then send only this header).
2. **`Authorization: Bearer <secret>`** — When the relevant env var is set (`CRON_SECRET` by default, or `SYSTEM_MOTOR_SECRET` / other `secretEnvVar` where the route passes options).
3. **`x-cron-secret: <same secret>`** — Fallback for local scripts and operators who prefer a dedicated header.

Manual trigger example (default `CRON_SECRET` routes):

```bash
curl -sS -X GET "https://app.lunchportalen.no/api/cron/menu-service-day-reconcile" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -i
```

Same pattern with header fallback:

```bash
curl -sS -X GET "https://app.lunchportalen.no/api/cron/menu-week-rollout" \
  -H "x-cron-secret: $CRON_SECRET" \
  -i
```

Routes that use `secretEnvVar: "SYSTEM_MOTOR_SECRET"` expect that value in Bearer / `x-cron-secret`, unless the request is a Vercel Cron invocation (`x-vercel-cron: 1`).

### Vercel project env

- Prefer setting **`CRON_SECRET`** in Production (and Preview if cron runs there) so manual triggers and non-Vercel schedulers can authenticate with Bearer.
- If `CRON_SECRET` is missing, **scheduled** crons still authenticate via `x-vercel-cron: 1` after FASE 13-IMPL-3K.
- Check env: `vercel env ls` (filter for `CRON_SECRET` / `SYSTEM_MOTOR_SECRET`).

### Operations

- **Logs:** Vercel Dashboard → Project → Logs (filter path e.g. `/api/cron/menu-service-day-reconcile`).
- **Misconfigured secret:** Routes typically return **500** with a “secret missing” style code when env is absent **and** the request is not a Vercel cron call.
- **Wrong secret / no auth (non-Vercel):** **403** `forbidden`.

## Schedules in `vercel.json`

| Path | Schedule (UTC) | Purpose |
|------|------------------|---------|
| `/api/cron/week-scheduler` | `*/10 * * * *` | Week scheduler tick |
| `/api/cron/forecast` | `0 2 * * *` | Forecast |
| `/api/cron/daily-order-summary` | `5 6,7 * * 1-5` | Daily order e-mail summary |
| `/api/cron/check-deviations` | `0 8,9,12,13 * * 1-5` | Deviation checks |
| `/api/cron/preprod` | `5 8 * * 1-5` | Preprod |
| `/api/cron/outbox` | `*/2 * * * *` | Outbox processor |
| `/api/cron/cleanup-invites` | `30 3 * * *` | Invite cleanup |
| `/api/cron/esg/daily` | `15 1 * * *` | ESG daily |
| `/api/cron/esg/monthly` | `20 1 1 * *` | ESG monthly |
| `/api/cron/esg/yearly` | `25 1 1 1 *` | ESG yearly |
| `/api/cron/menu-service-day-reconcile` | `0 */6 * * *` | Menu service day backup sync / reconcile |
| `/api/cron/menu-week-rollout` | `0 12 * * 4` | Thursday 12:00 UTC — rolling menu week (N+3) |

Additional **`/api/cron/*`** routes exist in the repo; they are not all listed in `vercel.json` and may be on-demand, legacy, or triggered by other schedulers.

## Related changes

- **FASE 13-IMPL-3K:** `requireCronAuth` accepts `x-vercel-cron: 1` first, fixing 403 / mis-auth when Vercel invokes cron without a Bearer secret in env.
